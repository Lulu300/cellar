import type { RequestEvent } from '@sveltejs/kit';
import type Database from 'better-sqlite3';
import { asc, count, eq, getTableColumns, getTableName } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteSelect, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { z } from 'zod';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { duplicateNameError, isForeignKeyRefusal } from '#lib/server/db-errors.js';
import { parseBody } from '#lib/server/http/body.js';
import { ConflictError, NotFoundError } from '#lib/server/http/errors.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { normalized } from '#lib/server/features/shared/names.js';

/** A row of a reference table as the API answers it: its name is `name` in every table. */
type LookupRow = { id: string; name: string } & Record<string, unknown>;

/** The fields of a POST or PUT body: the name, and the id of the parent row when there is one. */
type Fields = { name: string } & Record<string, string>;

type RowsQuery = SQLiteSelect<string, 'sync', Database.RunResult>;

type ColumnOf<Table extends SQLiteTable> = keyof Table['_']['columns'] & string;

export interface LookupConfig<Table extends SQLiteTable> {
    table: Table;
    /** The column that holds the name, which the API calls `name` whatever the table calls it. */
    nameColumn: ColumnOf<Table>;
    /** The body of POST and PUT. */
    schema: z.ZodType<Fields>;
    /**
     * The column of the parent row's id, named as in the body and the table (`countryId`). Names
     * are unique per parent, and the list takes it as a filter: `GET /api/regions?countryId=…`.
     */
    parent?: ColumnOf<Table>;
    /**
     * The rows as the API answers them, such as with the names of their parents; such a query
     * selects the name as `name` itself. By default, the table's columns with the name renamed.
     */
    rows?: (tx: Tx) => RowsQuery;
    /** The foreign key of the rows that use this table, which keeps a used row from deletion. */
    usage: {
        column: AnySQLiteColumn;
        usedBy: 'wine_definitions' | 'bottles' | 'regions' | 'appellations';
    };
}

const notFound = () => new NotFoundError('No entry has this id');

/**
 * The handlers of a reference table: GET (the list) and POST for its collection, PUT and DELETE
 * for one row, and the list itself for the load functions. Reads are public; hooks.server.ts
 * asks a session for the writes.
 */
export function createLookupCrud<Table extends SQLiteTable>(config: LookupConfig<Table>) {
    const { table, usage } = config;
    const columns: Record<string, AnySQLiteColumn> = getTableColumns(table);
    const idColumn = columns.id;
    const nameColumn = columns[config.nameColumn];
    const parentColumn = config.parent && columns[config.parent];
    // An origin has no updatedAt.
    const hasUpdatedAt = 'updatedAt' in columns;

    // The other columns as they are, and the name column as `name`.
    const rowColumns = Object.fromEntries(
        Object.entries(columns).map(([key, column]) => [
            key === config.nameColumn ? 'name' : key,
            column
        ])
    );
    const rows = config.rows ?? ((tx: Tx) => tx.select(rowColumns).from(table).$dynamic());

    const getRow = (id: string, tx: Tx) =>
        rows(tx).where(eq(idColumn, id)).get() as LookupRow | undefined;

    /** The table's columns for the fields of a body. */
    function valuesOf({ name, ...parentId }: Fields) {
        return { [config.nameColumn]: name, ...parentId };
    }

    function list(parentId: string | null = null): LookupRow[] {
        const ofParent = parentColumn && parentId ? eq(parentColumn, parentId) : undefined;
        return rows(db).where(ofParent).orderBy(asc(nameColumn)).all() as LookupRow[];
    }

    /**
     * The rows with the name of `fields` (under its parent), whatever their case, as the CSV
     * import compares names (API-03). Several only when older versions stored the name in
     * several cases.
     */
    function namesakes(fields: Fields, tx: Tx): LookupRow[] {
        const ofParent = parentColumn && eq(parentColumn, fields[config.parent!]);
        // SQLite's lower() leaves accented letters as they are: the names are compared here.
        return (rows(tx).where(ofParent).all() as LookupRow[]).filter(
            (row) => normalized(row.name) === normalized(fields.name)
        );
    }

    /** The row with this name (under this parent), whatever its case; created when there is none. */
    function findOrCreate(fields: Fields): { row: LookupRow; created: boolean } {
        return db.transaction((tx) => {
            const [existing] = namesakes(fields, tx);
            if (existing) return { row: existing, created: false };

            const { id } = tx
                .insert(table)
                .values(valuesOf(fields) as Table['$inferInsert'])
                .returning({ id: idColumn })
                .get() as { id: string };
            return { row: getRow(id, tx)!, created: true };
        });
    }

    /**
     * The row with its new name and parent. A name that another row has, whatever its case, is
     * refused: POST would answer that row, so renaming would make a near-duplicate of it.
     */
    function update(id: string, fields: Fields): LookupRow {
        return db.transaction((tx) => {
            if (!getRow(id, tx)) throw notFound();
            if (namesakes(fields, tx).some((row) => row.id !== id)) {
                throw duplicateNameError(getTableName(table));
            }
            tx.update(table)
                .set({
                    ...valuesOf(fields),
                    ...(hasUpdatedAt && { updatedAt: new Date() })
                } as Partial<Table['$inferInsert']>)
                .where(eq(idColumn, id))
                .run();
            return getRow(id, tx)!;
        });
    }

    /**
     * The foreign key, not a check made before, refuses to delete a row that others use: a row
     * that starts to be used meanwhile is refused too. The rows that use it are then counted,
     * for the admin page to say how many.
     */
    function remove(id: string): void {
        try {
            if (db.delete(table).where(eq(idColumn, id)).run().changes === 0) throw notFound();
        } catch (error) {
            if (!isForeignKeyRefusal(error)) throw error;
            const usageCount =
                db
                    .select({ count: count() })
                    .from(usage.column.table)
                    .where(eq(usage.column, id))
                    .get()?.count ?? 0;
            throw new ConflictError('in_use', `Still used by ${usageCount} ${usage.usedBy}`, {
                count: usageCount,
                usedBy: usage.usedBy
            });
        }
    }

    type ItemEvent = RequestEvent<{ id: string }>;

    return {
        /** The rows, sorted by name; only those of `parentId` when given. */
        list,
        collection: {
            GET: apiHandler(({ url }) =>
                Response.json(list(config.parent ? url.searchParams.get(config.parent) : null))
            ),
            // 201 for a new row; 200 with the existing one when a row already has this name.
            POST: apiHandler(async ({ request }) => {
                const { row, created } = findOrCreate(await parseBody(request, config.schema));
                return Response.json(row, { status: created ? 201 : 200 });
            })
        },
        item: {
            PUT: apiHandler(async ({ params, request }: ItemEvent) =>
                Response.json(update(params.id, await parseBody(request, config.schema)))
            ),
            DELETE: apiHandler(({ params }: ItemEvent) => {
                remove(params.id);
                return new Response(null, { status: 204 });
            })
        }
    };
}
