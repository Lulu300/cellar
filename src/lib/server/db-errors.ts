import Database from 'better-sqlite3';
import { eq, getTableColumns } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { Tx } from './db/connection.js';
import { ApiError, ConflictError, invalidField } from './http/errors.js';

function sqliteCode(error: unknown): string | undefined {
    return error instanceof Database.SqliteError ? error.code : undefined;
}

interface Rule {
    /** SQLite's code for the refusal. */
    sqliteCode: string;
    /** What SQLite's message names: the constraint, or the columns of the unique index. */
    names: string;
    /** What the API answers. */
    error: () => ApiError;
}

/** The rules of migrations 0006 and 0014 that a write can break. */
const RULES = {
    duplicate_region: {
        sqliteCode: 'SQLITE_CONSTRAINT_UNIQUE',
        names: 'regions.country_id',
        error: () =>
            new ConflictError(
                'duplicate_region',
                'This country already has a region with this name'
            )
    },
    duplicate_appellation: {
        sqliteCode: 'SQLITE_CONSTRAINT_UNIQUE',
        names: 'appellations.region_id',
        error: () =>
            new ConflictError(
                'duplicate_appellation',
                'This region already has an appellation with this name'
            )
    },
    duplicate_barcode: {
        sqliteCode: 'SQLITE_CONSTRAINT_UNIQUE',
        names: 'wine_bottles.barcode',
        error: () =>
            new ConflictError(
                'duplicate_barcode',
                'This barcode is already assigned to another bottle'
            )
    },
    duplicate_container: {
        sqliteCode: 'SQLITE_CONSTRAINT_UNIQUE',
        names: 'storage_containers.name',
        error: () => new ConflictError('duplicate_container', 'A container has this name already')
    },
    duplicate_case: {
        sqliteCode: 'SQLITE_CONSTRAINT_UNIQUE',
        names: 'storage_cases.container_id',
        error: () =>
            new ConflictError('duplicate_case', 'This container has a case with this name already')
    },
    invalid_rating: {
        sqliteCode: 'SQLITE_CONSTRAINT_CHECK',
        names: 'wine_definitions_rating_check',
        error: () => invalidField('rating', 'The rating must be from 1 to 5')
    },
    invalid_availability: {
        sqliteCode: 'SQLITE_CONSTRAINT_CHECK',
        names: 'wine_bottles_availability_check',
        error: () =>
            invalidField(
                'availability',
                `The availability must be one of ${Object.values(BottleAvailability).join(', ')}`
            )
    }
} satisfies Record<string, Rule>;

export type BrokenRule = keyof typeof RULES;

const duplicateName = () =>
    new ConflictError('duplicate_name', 'An entry with this name already exists');

/**
 * The 409 that the unique index of the reference table `table` answers for a name that another
 * row has (under the same parent for regions and appellations). The index compares names exactly,
 * so a name that differs only by case gets it from this function instead. For reference tables
 * only: the rule is found by the table's name in the columns of its index, so another table with a
 * unique column, such as wine_bottles and its barcode, would get that column's rule.
 */
export function duplicateNameError(table: string): ApiError {
    const rule = Object.values(RULES).find(
        (unique) =>
            unique.sqliteCode === 'SQLITE_CONSTRAINT_UNIQUE' && unique.names.startsWith(`${table}.`)
    );
    return rule ? rule.error() : duplicateName();
}

/** The rule that SQLite refused a write for, or undefined for any other error. */
export function brokenRule(error: unknown): BrokenRule | undefined {
    const code = sqliteCode(error);
    if (!code) return undefined;
    const message = (error as Error).message;
    return (Object.keys(RULES) as BrokenRule[]).find(
        (rule) => RULES[rule].sqliteCode === code && message.includes(RULES[rule].names)
    );
}

/** A field of a write, and the id it gives, which refers to no row. */
export interface MissingReference {
    field: string;
    id: string;
}

function missingReferenceMessage(missing: MissingReference[]): string {
    const message = 'An entry it refers to does not exist';
    if (missing.length === 0) return message;
    return `${message} (${missing.map(({ field, id }) => `${field} ${id}`).join(', ')})`;
}

/**
 * A write refers to a row that does not exist. `missing` names each field and the id it gives, in
 * the message and the details, when the write could tell them: SQLite's error names no column.
 */
export class MissingReferenceError extends ConflictError {
    constructor(readonly missing: MissingReference[] = []) {
        super(
            'missing_reference',
            missingReferenceMessage(missing),
            missing.length > 0 ? missing : undefined
        );
    }
}

/** The values a write gives the columns of `table`. */
type Values<Table extends SQLiteTable> = Partial<Table['$inferInsert']>;

/** The fields of `values` whose id refers to no row, by the foreign keys of `table`, in its order. */
function missingReferences<Table extends SQLiteTable>(
    table: Table,
    values: Values<Table>,
    tx: Tx
): MissingReference[] {
    const references = getTableConfig(table).foreignKeys.map((foreignKey) =>
        foreignKey.reference()
    );
    return Object.entries(getTableColumns(table)).flatMap(([field, column]) => {
        const id: unknown = values[field as keyof Values<Table>];
        // Keys of one column only: the schema has no other kind.
        const reference = references.find(
            ({ columns }) => columns.length === 1 && columns[0] === column
        );
        if (typeof id !== 'string' || !reference) return [];
        const [foreignColumn] = reference.foreignColumns;
        const found = tx
            .select({ id: foreignColumn })
            .from(reference.foreignTable)
            .where(eq(foreignColumn, id))
            .get();
        return found ? [] : [{ field, id }];
    });
}

/**
 * Runs `write`, which writes `values` in `table`, and when a foreign key refuses it, throws a
 * MissingReferenceError naming the fields of `values` whose id refers to no row. As for a deletion
 * in lookup-crud, the foreign key refuses and the refusal is explained after, so a write that goes
 * through costs no query. Any other error, or a refusal that names none of `values`, goes on as it
 * is.
 */
export function namingMissingReferences<Table extends SQLiteTable, T>(
    table: Table,
    values: Values<Table>,
    tx: Tx,
    write: () => T
): T {
    try {
        return write();
    } catch (error) {
        if (!isForeignKeyRefusal(error)) throw error;
        const missing = missingReferences(table, values, tx);
        if (missing.length === 0) throw error;
        throw new MissingReferenceError(missing);
    }
}

/**
 * The ApiError for a write that SQLite refused, or undefined for any other error. A foreign key
 * refuses a deletion when other rows still use the row, and any other write when a row it refers
 * to does not exist.
 */
export function refusedWriteError(error: unknown, method: string): ApiError | undefined {
    const rule = brokenRule(error);
    if (rule) return RULES[rule].error();
    switch (sqliteCode(error)) {
        case 'SQLITE_CONSTRAINT_UNIQUE':
            return duplicateName();
        case 'SQLITE_CONSTRAINT_FOREIGNKEY':
            return method === 'DELETE'
                ? new ConflictError('in_use', 'Other entries still use this one')
                : new MissingReferenceError();
        default:
            return undefined;
    }
}

/** Whether a foreign key refused the write: a deleted row that others use, or a missing one. */
export function isForeignKeyRefusal(error: unknown): boolean {
    return sqliteCode(error) === 'SQLITE_CONSTRAINT_FOREIGNKEY';
}

/** Whether SQLite refused the write for a constraint: NOT NULL, UNIQUE, CHECK or a foreign key. */
export function isConstraintRefusal(error: unknown): boolean {
    return sqliteCode(error)?.startsWith('SQLITE_CONSTRAINT') ?? false;
}
