import { z } from 'zod';
import type { ExportTableName } from '#lib/server/features/backup/export.js';
import {
    INVALID_IMAGE_FILENAME_ERROR,
    IMAGES_URL_PATH,
    isImageFileName
} from '#lib/server/paths.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { bottleSchema } from '#lib/shared/schemas/bottle.js';
import {
    asLongText,
    id,
    LONG_TEXT_MAX_LENGTH,
    name,
    NAME_MAX_LENGTH,
    optionalId
} from '#lib/shared/schemas/common.js';
import { appellationSchema, regionSchema } from '#lib/shared/schemas/geography.js';
import { namedSchema, wineColorSchema, wineTypeSchema } from '#lib/shared/schemas/reference.js';
import { caseCapacitySchema, caseName, casePosition } from '#lib/shared/schemas/storage.js';
import { GRAPE_MAX_LENGTH, wineDefinitionSchema } from '#lib/shared/schemas/wine.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';

/**
 * The columns of a row of each table that an import takes, with the rules of the API: any other
 * column of the file is left out. The ids and timestamps are not here: the JSON import keeps those
 * of the export, the CSV import gives new ones.
 */
const ROW_SCHEMAS = {
    countries: namedSchema,
    regions: regionSchema,
    appellations: appellationSchema,
    wineClassifications: namedSchema,
    wineTypes: wineTypeSchema,
    wineColors: wineColorSchema,
    wineFormats: namedSchema,
    origins: namedSchema,
    storageContainers: z.object({ name, parentContainerId: optionalId }),
    // Exports made before cases had a position lack it: the cases keep the order those versions
    // showed.
    storageCases: z.object({
        name: caseName,
        capacity: caseCapacitySchema,
        position: casePosition.optional(),
        containerId: id
    }),
    // An image row points at a file of the images folder: its name only, never a path.
    wineImages: z
        .object({ filename: z.string().refine(isImageFileName, INVALID_IMAGE_FILENAME_ERROR) })
        .transform((image) => ({ ...image, path: IMAGES_URL_PATH })),
    wineDefinitions: wineDefinitionSchema,
    wineBottles: bottleSchema,
    winePhotos: z.object({ definitionId: id, imageId: id }),
    wishes: wishSchema
} satisfies Record<ExportTableName, z.ZodType>;

export type ImportedRow = Record<string, unknown>;

/** The columns that an import takes from a row of `table`, each with its rule. */
export function rowColumns(table: ExportTableName): Record<string, z.ZodType> {
    const schema = ROW_SCHEMAS[table];
    // The image rows are a pipe that adds the path to the object read.
    return (schema instanceof z.ZodPipe ? schema.in : schema).shape;
}

/** `text` with `line` added on a line of its own. */
function withLine(text: unknown, line: string): string {
    return typeof text === 'string' && text.trim() !== '' ? `${text}\n${line}` : line;
}

const STATUSES: string[] = Object.values(BottleAvailability);

/**
 * Grape varieties as a list of names: the CSV export separates them with `;`, and older files may
 * hold a JSON list, a single value of any type, or none (null).
 */
function grapeList(value: unknown): string[] {
    let list = value;
    if (typeof list === 'string' && list.trim().startsWith('[')) {
        try {
            list = JSON.parse(list);
        } catch {
            // A name that starts with a bracket.
        }
    }
    if (typeof list === 'string') list = list.split(';');
    if (list == null) return [];
    return (Array.isArray(list) ? list : [list])
        .map((grape) => String(grape).trim())
        .filter((grape) => grape !== '');
}

const { rating: ratingSchema, targetQuantity: targetSchema } = wineDefinitionSchema.shape;

/**
 * A wine whose rating or target quantity breaks the rules of the API loses it, with a line in its
 * description: nothing the user entered is lost (DATA-03). A rating of 0 is how older versions
 * showed none.
 */
function repairedWine(row: ImportedRow): ImportedRow {
    const wine: ImportedRow = { ...row, grapeVarieties: grapeList(row.grapeVarieties) };
    if (wine.rating === 0) wine.rating = null;
    if (!ratingSchema.safeParse(wine.rating).success) {
        wine.description = withLine(
            wine.description,
            `Rating ${wine.rating} removed in the import: ratings go from 1 to 5.`
        );
        wine.rating = null;
    }
    if (!targetSchema.safeParse(wine.targetQuantity).success) {
        wine.description = withLine(
            wine.description,
            `Target quantity ${wine.targetQuantity} removed in the import: it is a whole number from 0 to 10000.`
        );
        wine.targetQuantity = null;
    }
    return wine;
}

/**
 * A bottle whose status the app does not know: a status in another case, with blanks around it or
 * blank stands for a valid one, and any other becomes out_of_cellar, as the app treated it, with a
 * line in the notes.
 */
function withKnownStatus(row: ImportedRow): ImportedRow {
    if (typeof row.availability !== 'string') return row;
    const status = row.availability.trim().toLowerCase();
    if (status === '') return { ...row, availability: undefined };
    if (STATUSES.includes(status)) return { ...row, availability: status };
    return {
        ...row,
        availability: BottleAvailability.OUT_OF_CELLAR,
        notes: withLine(
            row.notes,
            `Status "${row.availability}" replaced by "out_of_cellar" in the import.`
        )
    };
}

/**
 * A bottle with a status the app knows, which loses a negative purchase price or current value that
 * earlier versions took, with a line in its notes for each, as migration 0015 does.
 */
function repairedBottle(row: ImportedRow): ImportedRow {
    const bottle = { ...withKnownStatus(row) };
    for (const [column, label, rule] of [
        ['purchasePrice', 'Purchase price', 'prices are 0 or more'],
        ['currentValue', 'Current value', 'values are 0 or more']
    ]) {
        const amount = bottle[column];
        if (typeof amount === 'number' && amount < 0) {
            bottle.notes = withLine(
                bottle.notes,
                `${label} ${amount} removed in the import: ${rule}.`
            );
            bottle[column] = null;
        }
    }
    return bottle;
}

/** The first `max` characters of `text`, without half an emoji at the end. */
function cut(text: string, max: number): string {
    const kept = text.slice(0, max);
    return /[\uD800-\uDBFF]$/.test(kept) ? kept.slice(0, -1) : kept;
}

/**
 * `row` with the text of `column` cut to LONG_TEXT_MAX_LENGTH characters, as migration 0011 cut the
 * notes and descriptions stored before that limit (DATA-10): with LF line breaks, which the forms
 * of earlier versions stored as CRLF. The end of a repair line may go with it.
 */
function withLongTextCut(row: ImportedRow, column: string): ImportedRow {
    const text = row[column];
    if (typeof text !== 'string') return row;
    return { ...row, [column]: cut(asLongText(text), LONG_TEXT_MAX_LENGTH) };
}

/** The columns that hold the name of a row, or the producer of a wine. */
const NAME_COLUMNS = ['name', 'type', 'color', 'producer'];

/**
 * `row` of an export with its names, its producer and its grape varieties cut to their limit.
 * Versions before 1.1.0 counted an emoji in them as one character, so a cellar may hold longer ones,
 * which would refuse the whole import (API-13). The CSV import does not cut them: it finds rows by
 * their names, and a name cut would not match at the next import of the same file. A case keeps its
 * name: it is that of its container followed by its suffix, which a cut would drop.
 */
export function withNamesCut(table: ExportTableName, row: ImportedRow): ImportedRow {
    if (table === 'storageCases') return row;
    const result = { ...row };
    for (const column of NAME_COLUMNS) {
        const text = result[column];
        if (typeof text === 'string') result[column] = cut(text.trim(), NAME_MAX_LENGTH);
    }
    if (table === 'wineDefinitions') {
        result.grapeVarieties = grapeList(result.grapeVarieties).map((grape) =>
            cut(grape, GRAPE_MAX_LENGTH)
        );
    }
    return result;
}

/**
 * The repairs of the upgrades, for the rows of older files: those of migrations 0006 (DATA-03) and
 * 0015 (negative prices), then the cut of long texts.
 */
function repaired(table: ExportTableName, row: ImportedRow): ImportedRow {
    if (table === 'wineDefinitions') return withLongTextCut(repairedWine(row), 'description');
    if (table === 'wineBottles') return withLongTextCut(repairedBottle(row), 'notes');
    return row;
}

/**
 * A column that a row lacks, or whose value breaks the rules of the API: `column` is empty for a
 * rule of the whole row.
 */
export type ColumnProblem = { code: 'missing' | 'invalid'; column: string };

/**
 * A row of an import file as the database takes it, repaired and checked by the rules of the API,
 * or what keeps it out: as text for the logs, such as `Missing name; capacity: Too big…`, and as
 * problems for the user to read in their language.
 */
export function importedRow(
    table: ExportTableName,
    row: ImportedRow
): { row: ImportedRow } | { problem: string; problems: ColumnProblem[] } {
    const values = repaired(table, row);
    const parsed = ROW_SCHEMAS[table].safeParse(values);
    if (parsed.success) return { row: parsed.data };
    const problems = parsed.error.issues.map(({ path, message }) => {
        const column = path.join('.');
        return path.length === 1 && values[column] === undefined
            ? { code: 'missing' as const, column, text: `Missing ${column}` }
            : { code: 'invalid' as const, column, text: `${column || 'row'}: ${message}` };
    });
    return {
        problem: problems.map(({ text }) => text).join('; '),
        problems: problems.map(({ code, column }) => ({ code, column }))
    };
}
