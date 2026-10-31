import { z } from 'zod';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { storedBarcode } from '#lib/shared/barcode.js';
import { id, longText, optionalDate, optionalId } from './common.js';
import { formNumbers, formTexts } from './form.js';

// The bounds are loose: the imports check each bottle of a file with these rules, so a tighter
// bound would refuse bottles that earlier versions stored. A vintage of 0 is accepted, as none.
// A negative price or value is refused: an import repairs it first, as migration 0015 repaired
// those stored (imported-rows.ts).

/** A year, or null. */
const year = z
    .int()
    .min(0)
    .max(9999)
    .nullish()
    .transform((value) => value ?? null);

/**
 * A year, or null. 0 means no vintage and is stored as null: the CSV import of 0.6.0 and earlier
 * wrote 0 for a blank vintage, which their exports still hold (DATA-09).
 */
const vintage = year.transform((value) => (value === 0 ? null : value));

/** A price or a value, or null: 0 or more. */
const amount = z
    .number()
    .min(0)
    .nullish()
    .transform((value) => value ?? null);

/** The most characters of a barcode that a request gives. */
export const BARCODE_MAX_LENGTH = 1000;

/** Text or a number, as a scanner or a spreadsheet gives it; stored trimmed, null when blank. */
const barcode = z
    .union([z.string().max(BARCODE_MAX_LENGTH), z.number()])
    .nullish()
    .transform((value) => (value == null ? null : storedBarcode(String(value))));

const availability = z.enum(BottleAvailability);

/** Every field of a bottle, as a POST or an import gives them. */
export const bottleSchema = z.object({
    definitionId: id,
    formatId: id,
    originId: optionalId,
    vintage,
    optimum: year,
    purchasePrice: amount,
    purchaseDate: optionalDate,
    currentValue: amount,
    currentValueDate: optionalDate,
    storageCaseId: optionalId,
    notes: longText,
    barcode,
    availability: availability.default(BottleAvailability.AVAILABLE),
    consumedDate: optionalDate
});

export type BottleInput = z.output<typeof bottleSchema>;

/**
 * Some fields of a bottle: a PATCH changes only those it names. A field the schema does not know
 * is refused rather than ignored, so that a misspelt one does not answer 200 for nothing.
 */
export const bottleChangesSchema = bottleSchema
    // Without its default, which would set every bottle patched back to available
    .extend({ availability })
    .partial()
    .strict();

export type BottleChanges = z.output<typeof bottleChangesSchema>;

/**
 * The most bottles one PATCH changes: well above a cellar's size, and below the number of
 * variables that one SQLite statement takes (32766).
 */
const MAX_BOTTLES_PER_UPDATE = 10_000;

/**
 * The same changes for each bottle of `ids`, and a note to add after the notes of each one, as a
 * note typed when consuming bottles: their own notes stay.
 */
export const bulkBottleChangesSchema = z
    .object({
        ids: z.array(id).min(1).max(MAX_BOTTLES_PER_UPDATE),
        changes: bottleChangesSchema,
        addedNote: longText
    })
    .strict();

/** The body of a PATCH of several bottles, as the client sends it. */
export type BulkBottleChangesBody = z.input<typeof bulkBottleChangesSchema>;

/** The largest number of bottles one request creates, each with its own row and barcode. */
const MAX_BOTTLES_PER_REQUEST = 100;

export const newBottlesSchema = bottleSchema.extend({
    quantity: z.int().min(1).max(MAX_BOTTLES_PER_REQUEST).default(1)
});

/**
 * The bottle of the bottle form, for newBottlesSchema or bottleChangesSchema to check: only the
 * fields it holds, as an edit sends only those that changed.
 */
export function bottleFromForm(form: FormData) {
    return {
        ...formTexts(form, [
            'definitionId',
            'formatId',
            'originId',
            'purchaseDate',
            'currentValueDate',
            'storageCaseId',
            'notes',
            'barcode',
            'availability',
            'consumedDate'
        ]),
        ...formNumbers(form, ['vintage', 'optimum', 'purchasePrice', 'currentValue', 'quantity'])
    };
}
