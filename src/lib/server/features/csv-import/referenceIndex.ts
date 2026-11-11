import type { Tx } from '#lib/server/db/connection.js';
import { EXPORT_TABLES } from '#lib/server/features/backup/export.js';
import { normalized } from '#lib/server/features/shared/names.js';
import type { CsvRecord } from './parse';
import { areClose } from '#lib/shared/names.js';
import type { RowOfFile, WineOption } from './review';
import { IMPORT_ORDER, keyOfName, parentOf, TABLES, type TableName } from './tables';

export type Row = { id: string } & Record<string, unknown>;

/** The columns that tell a wine apart, as the CSV export names them. */
const WINE_KEY = [
    'name',
    'producer',
    'appellationName',
    'classificationName',
    'typeName',
    'colorName'
];
/** Those a bottle file may name its wine by, besides wineName. */
export const WINE_COLUMNS = [...WINE_KEY.slice(1), 'regionName'];
/**
 * Those of the key that every bottle export writes, typeName aside, which exports before 0.9.0 left
 * out. In a file that has them all, a blank one means that the wine has none.
 */
const EXPORTED_WINE_COLUMNS = WINE_KEY.filter(
    (column) => column !== 'name' && column !== 'typeName'
);

/** The tables that the columns of a wine name, such as producers for `producer`. */
const NAMED_TABLES = new Map(
    Object.values(TABLES.wineDefinitions.references!).map(({ csvColumn, table }) => [
        csvColumn,
        table
    ])
);

/** A value of a column of a wine as values are compared: a name as its table compares names. */
function columnKey(column: string, value: unknown): string {
    const table = NAMED_TABLES.get(column);
    return table ? keyOfName(table, value) : normalized(value);
}

/**
 * The identity of a wine, the same for a wine of the cellar and for a row of a wine file. The region
 * is left out: the appellation gives it, and older exports have no regionName column.
 */
function wineKey(wine: Record<string, unknown>): string {
    return WINE_KEY.map((column) => columnKey(column, wine[column])).join('|');
}

/** A row of a wine file as rows are compared: neither the order, the case nor blank columns count. */
function rowIdentity(record: CsvRecord): string {
    const values = Object.entries(record)
        .filter(([, value]) => value !== '')
        .map(([column, value]) => [column, columnKey(column, value)]);
    return JSON.stringify(values.toSorted(([a], [b]) => a.localeCompare(b)));
}

/**
 * The rows that the files of an import refer to, loaded once, then kept up to date with the rows
 * that the import adds.
 */
export class ReferenceIndex {
    private byId = new Map<TableName, Map<string, Row>>();
    /** The rows of each name, oldest first. */
    private byName = new Map<TableName, Map<string, Row[]>>();
    /** The wines that the cellar had before this import, the first of each key. */
    private cellarWinesByKey = new Map<string, Row>();
    private winesByName = new Map<string, Row[]>();
    /**
     * The distinct rows of the wine files of this import, by key, each with the wine that the
     * import added for it, if any.
     */
    private wineRowsByKey = new Map<string, Map<string, Row | undefined>>();
    /** The row of a wines file that each wine added by this import comes from, both ways. */
    private wineSources = new Map<string, RowOfFile>();
    /** The first row of the wine files of this import for each key. */
    private wineRowsAt = new Map<string, RowOfFile>();
    private winesBySource = new Map<string, Row>();
    /** The names close to a name, by table and name, which the rows of a file often repeat. */
    private close = new Map<string, string[]>();

    constructor(tx: Tx) {
        for (const table of IMPORT_ORDER) {
            this.byId.set(table, new Map());
            this.byName.set(table, new Map());
            // Bottles are not referred to; bottles.ts reads those it needs.
            if (table === 'wineBottles') continue;
            for (const row of tx.select().from(EXPORT_TABLES[table]).all()) this.add(table, row);
        }
        for (const wine of [...this.winesByName.values()].flat()) {
            const key = wineKey(wine);
            if (!this.cellarWinesByKey.has(key)) this.cellarWinesByKey.set(key, wine);
        }
    }

    add(table: TableName, row: Row): void {
        this.byId.get(table)!.set(row.id, row);
        const { nameColumn } = TABLES[table];
        const name = nameColumn ? keyOfName(table, row[nameColumn]) : '';
        const byName = this.byName.get(table)!;
        if (name) byName.set(name, [...(byName.get(name) ?? []), row]);
        if (table === 'wineDefinitions') this.addWine(row);
    }

    /**
     * The row of `table` named `name`. A row named within a parent, such as a region within its
     * country, is the one under `parent`, given by its id or its name; without a parent, it is the
     * first row of the name, as the earlier versions did.
     */
    find(table: TableName, name: string, parent?: { id: string } | { name: string }) {
        const rows = this.byName.get(table)!.get(keyOfName(table, name)) ?? [];
        const of = parentOf(table);
        if (!parent || !of) return rows[0];
        return rows.find((row) =>
            'id' in parent
                ? row[of.column] === parent.id
                : normalized(this.nameOf(of.reference.table, row[of.column])) ===
                  normalized(parent.name)
        );
    }

    /** The country of a region of the cellar or of the import. */
    countryOfRegion(regionId: string): string | undefined {
        return this.byId.get('regions')!.get(regionId)?.countryId as string | undefined;
    }

    ids(table: TableName): string[] {
        return [...this.byId.get(table)!.keys()];
    }

    private nameOf(table: TableName, id: unknown, column = TABLES[table].nameColumn!): unknown {
        return this.byId.get(table)!.get(id as string)?.[column];
    }

    /** A wine with the names of the rows it refers to, as the CSV export writes them. */
    private addWine(row: Row): void {
        const appellation = this.byId.get('appellations')!.get(row.appellationId as string);
        const wine: Row = {
            ...row,
            producer: this.nameOf('producers', row.producerId),
            appellationName: appellation?.name,
            regionName: this.nameOf('regions', appellation?.regionId),
            classificationName: this.nameOf('wineClassifications', row.classificationId),
            typeName: this.nameOf('wineTypes', row.typeId),
            colorName: this.nameOf('wineColors', row.colorId, 'color')
        };
        const name = normalized(wine.name);
        this.winesByName.set(name, [...(this.winesByName.get(name) ?? []), wine]);
    }

    /**
     * Records a row of a wine file, and returns the wine it stands for, if any: a wine of its key
     * that the cellar had before this import, or the wine added for an identical row. Rows of one
     * key that differ in another column, such as the rating, stand for several wines, so that the
     * bottles of either are reported, in this import as in a later one; identical rows stand for
     * one. A wine of the cellar is not compared to the rows: it may have changed since its file
     * was exported, and importing that file again must not add it a second time.
     */
    recordWineRow(record: CsvRecord, at: RowOfFile): Row | undefined {
        const key = wineKey(record);
        if (!this.wineRowsAt.has(key)) this.wineRowsAt.set(key, at);
        const identity = rowIdentity(record);
        const rows = this.wineRowsByKey.get(key) ?? new Map();
        if (!rows.has(identity)) rows.set(identity, undefined);
        this.wineRowsByKey.set(key, rows);
        return this.cellarWinesByKey.get(key) ?? rows.get(identity);
    }

    /**
     * Records the wine that the import added for the row `at` of a wine file, after recordWineRow.
     */
    recordImportedWine(record: CsvRecord, wine: Row, at: RowOfFile): void {
        this.wineRowsByKey.get(wineKey(record))!.set(rowIdentity(record), wine);
        this.wineSources.set(wine.id, at);
        this.winesBySource.set(JSON.stringify([at.file, at.row]), wine);
    }

    /** The wine that an answer of the review names: one of the cellar, or of a row of the import. */
    wineOfChoice(choice: { id: string } | RowOfFile): Row | undefined {
        if ('id' in choice) return this.byId.get('wineDefinitions')!.get(choice.id);
        return this.winesBySource.get(JSON.stringify([choice.file, choice.row]));
    }

    /** The wine that a bottle names, as the review keys its answer: the columns that name it. */
    bottleWineKey(record: CsvRecord): string {
        const columns = ['wineName', ...WINE_COLUMNS];
        return JSON.stringify([
            'wine',
            ...columns.map((column) => columnKey(column, record[column]))
        ]);
    }

    /**
     * The wines that a bottle may be meant for: those that it names, or, when it names none, those
     * of a close name.
     */
    wineOptions(record: CsvRecord): WineOption[] {
        const named = this.winesOfBottle(record);
        const wines =
            named.length > 0
                ? named
                : [...this.winesByName.values()]
                      .flat()
                      .filter((wine) => areClose(String(wine.name), record.wineName ?? ''));
        return wines.map((wine) => this.wineOption(wine));
    }

    /**
     * The row of a wines file of this import that names the wine of a bottle, when no wine was
     * added for it: the bottle waits for that row to be settled.
     */
    pendingWine(record: CsvRecord): RowOfFile | undefined {
        const key = wineKey({ ...record, name: record.wineName });
        const rows = this.wineRowsByKey.get(key);
        if (!rows || [...rows.values()].some(Boolean)) return undefined;
        return this.wineRowsAt.get(key);
    }

    /** Every wine of the cellar and of the import, for the user to choose one. */
    allWineOptions(): WineOption[] {
        return [...this.winesByName.values()].flat().map((wine) => this.wineOption(wine));
    }

    private wineOption(wine: Row): WineOption {
        const text = (value: unknown) => (value == null || value === '' ? null : String(value));
        const description = text(wine.description);
        return {
            wine: this.wineSources.get(wine.id) ?? { id: wine.id },
            name: String(wine.name),
            producer: text(wine.producer),
            appellation: text(wine.appellationName),
            region: text(wine.regionName),
            classification: text(wine.classificationName),
            type: text(wine.typeName),
            color: text(wine.colorName),
            rating: (wine.rating as number | null) ?? null,
            grapeVarieties: (wine.grapeVarieties as string[] | null) ?? [],
            description: description && description.slice(0, 200)
        };
    }

    /** The names of the rows of `table`, with that of their parent, for the user to choose one. */
    namesOf(table: TableName): { name: string; parent?: string }[] {
        return [...this.byId.get(table)!.keys()].map((id) => this.named(table, id)!);
    }

    /** The name of the row `id` of `table`, with that of its parent, if it exists. */
    named(table: TableName, id: string): { name: string; parent?: string } | undefined {
        const row = this.byId.get(table)!.get(id);
        if (!row) return undefined;
        const of = parentOf(table);
        return {
            name: String(row[TABLES[table].nameColumn!]),
            ...(of && { parent: String(this.nameOf(of.reference.table, row[of.column]) ?? '') })
        };
    }

    /** The names of the rows of `table` close to `name`, the first five. */
    closeNames(table: TableName, name: string): string[] {
        const key = JSON.stringify([table, keyOfName(table, name)]);
        let close = this.close.get(key);
        if (!close) {
            const names = new Set(this.namesOf(table).map((row) => row.name));
            close = [...names].filter((other) => areClose(other, name)).slice(0, 5);
            this.close.set(key, close);
        }
        return close;
    }

    /** The wine that a row of a bottle file stands for, or why it stands for none. */
    wineOfBottle(record: CsvRecord): Row | 'unknown_wine' | 'several_wines' {
        const wines = this.winesOfBottle(record);
        if (wines.length === 0) return 'unknown_wine';
        const [wine] = wines;
        return wines.length > 1 || (this.wineRowsByKey.get(wineKey(wine))?.size ?? 0) > 1
            ? 'several_wines'
            : wine;
    }

    /**
     * The wines that a row of a bottle file may stand for, by wineName and the columns the file has.
     * A blank column matches any wine, except a column that every export writes, in a file that has
     * them all.
     */
    winesOfBottle(record: CsvRecord): Row[] {
        const exported = EXPORTED_WINE_COLUMNS.every((column) => column in record);
        return (this.winesByName.get(normalized(record.wineName)) ?? []).filter((wine) =>
            WINE_COLUMNS.every(
                (column) =>
                    columnKey(column, record[column]) === columnKey(column, wine[column]) ||
                    (!record[column] && !(exported && EXPORTED_WINE_COLUMNS.includes(column)))
            )
        );
    }
}
