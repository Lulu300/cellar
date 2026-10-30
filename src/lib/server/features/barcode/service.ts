import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { csvLine } from '#lib/server/csv.js';
import { ConflictError, ValidationError } from '#lib/server/http/errors.js';
import {
    BarcodeRangeError,
    formatBarcode,
    formatBarcodeRange,
    INVALID_BARCODE_PREFIX_ERROR,
    isValidBarcodePrefix,
    maxBarcodeNumber
} from '#lib/shared/barcode.js';
import {
    bottlesWithAnyBarcode,
    bottlesWithBarcodes,
    bottlesWithGeneratedBarcodes,
    countBottlesWithBarcode,
    countGeneratedBarcodes,
    getBarcodeSettings,
    getLastBarcodeNumber,
    highestGeneratedBarcodeNumber,
    saveBarcodeSettings,
    setLastBarcodeNumber,
    type BarcodeRow,
    type BarcodeSettings
} from './repository';

export { getBarcodeSettings };

/**
 * The number of the next code of `prefix`: after the last number given, even when its bottle is
 * gone, since its label may still be on a bottle; after the highest code in the cellar, which an
 * import, a restore or a manual code may have put past the last number given; and from the start
 * number. Pass the settings to check before they are saved.
 */
export function getNextBarcodeNumber(
    { prefix, startNumber }: { prefix: string; startNumber: number },
    tx: Tx = db
): number {
    const lastGiven = getLastBarcodeNumber(prefix, tx);
    return Math.max(startNumber, lastGiven + 1, highestGeneratedBarcodeNumber(prefix, tx) + 1);
}

/**
 * The barcodes of `quantity` new bottles, recorded as given: call it in the transaction that
 * inserts them, so that a failed insert gives none. Null when barcodes are not automatic. Throws,
 * before recording anything, BarcodeRangeError when the prefix has too few numbers left, and
 * BarcodePrefixTooLongError for an old prefix longer than 6 characters.
 */
export function takeNextBarcodes(quantity: number, tx: Tx): string[] | null {
    const settings = getBarcodeSettings(tx);
    if (!settings.autoGeneration) return null;
    const first = getNextBarcodeNumber(settings, tx);
    const barcodes = Array.from({ length: quantity }, (_, i) =>
        formatBarcode(settings.prefix, first + i)
    );
    setLastBarcodeNumber(settings.prefix, first + quantity - 1, tx);
    return barcodes;
}

/**
 * In the staged copy of a restore: keeps, for each prefix, the higher of the last number given in
 * the live cellar (`live`) and in the backup. The labels printed after the backup was taken stay
 * on their bottles, so their numbers are never given again.
 */
export function putBackLastBarcodeNumbers(staged: Tx, live: Map<string, number>): void {
    for (const [prefix, number] of live) {
        if (number > getLastBarcodeNumber(prefix, staged)) {
            setLastBarcodeNumber(prefix, number, staged);
        }
    }
}

const barcodeGenerationOff = () =>
    new ConflictError('barcode_generation_off', 'Barcode auto-generation is disabled');

/** The barcode the next bottle gets. Throws a ConflictError when barcodes are not automatic. */
export function nextBarcode() {
    const settings = getBarcodeSettings();
    if (!settings.autoGeneration) throw barcodeGenerationOff();

    const nextNumber = getNextBarcodeNumber(settings);
    // Throws (409) once the prefix has no number left, or for a prefix too long.
    const barcode = formatBarcode(settings.prefix, nextNumber);
    return { barcode, nextNumber, prefix: settings.prefix };
}

/** Throws a ValidationError for a prefix that a request gives: at most 6 letters, digits or -. */
function checkedPrefix(prefix: string): string {
    if (!isValidBarcodePrefix(prefix)) {
        throw new ValidationError('invalid_barcode_prefix', INVALID_BARCODE_PREFIX_ERROR);
    }
    return prefix;
}

/** The error for a number that a request asks for past the last one of `prefix`. */
function barcodeOutOfRange(prefix: string): ValidationError {
    const max = maxBarcodeNumber(prefix);
    return new ValidationError(
        'barcode_out_of_range',
        `With prefix "${prefix}", barcode numbers go from 1 to ${max}`,
        { min: 1, max }
    );
}

/** Tells, with automatic barcodes, when the sequence goes on past the start requested. */
export interface BarcodeConflictInfo {
    hasConflict: boolean;
    requestedStart: number;
    actualNext: number;
    nextBarcode: string;
}

/** Saves the settings as requested, not adjusted. */
export function updateBarcodeSettings(requested: BarcodeSettings): BarcodeConflictInfo | null {
    const { autoGeneration, startNumber } = requested;
    const prefix = checkedPrefix(requested.prefix);
    if (startNumber > maxBarcodeNumber(prefix)) throw barcodeOutOfRange(prefix);

    // The next number is read in the transaction that saves the settings.
    return db.transaction((tx) => {
        let conflictInfo = null;
        if (autoGeneration) {
            const nextAvailable = getNextBarcodeNumber({ prefix, startNumber }, tx);
            conflictInfo = {
                hasConflict: nextAvailable > startNumber,
                requestedStart: startNumber,
                actualNext: nextAvailable,
                // Throws, before any setting is saved, when the prefix has no number left (409).
                nextBarcode: formatBarcode(prefix, nextAvailable)
            };
        }
        saveBarcodeSettings({ autoGeneration, prefix, startNumber }, tx);
        return conflictInfo;
    });
}

/** How many bottles have a generated code of the configured prefix, and the next number. */
export function barcodeStats() {
    const settings = getBarcodeSettings();
    if (!settings.autoGeneration) {
        return { totalWithBarcode: 0, nextNumber: null, prefix: settings.prefix };
    }
    return {
        totalWithBarcode: countGeneratedBarcodes(settings.prefix),
        // The page formats it, so that a sequence past its last number shows a translated
        // message rather than an error.
        nextNumber: getNextBarcodeNumber(settings),
        prefix: settings.prefix
    };
}

/** How many bottles have a barcode, whatever its prefix. */
export function manualBarcodeStats() {
    return { totalWithBarcode: countBottlesWithBarcode() };
}

/**
 * The prefix of the codes a label export lists: the configured one with automatic barcodes, the
 * one the request gives otherwise. Throws a ValidationError for a missing or invalid one.
 */
export function labelPrefix(requested: string | null | undefined): string {
    const settings = getBarcodeSettings();
    if (settings.autoGeneration) return settings.prefix;
    if (!requested) {
        throw new ValidationError(
            'barcode_prefix_required',
            'Barcode auto-generation is disabled and no prefix was provided'
        );
    }
    return checkedPrefix(requested);
}

/**
 * The `count` codes of `prefix` from `start` that a request asked for: a range past the last
 * number of the prefix is a ValidationError, not a sequence that ran out.
 */
export function requestedBarcodeRange(prefix: string, start: number, count: number): string[] {
    try {
        return formatBarcodeRange(prefix, start, count);
    } catch (error) {
        if (error instanceof BarcodeRangeError) throw barcodeOutOfRange(prefix);
        throw error;
    }
}

/** A CSV file to download. */
export interface CsvFile {
    filename: string;
    csv: string;
}

const CSV_HEADER = 'barcode,wine_name,producer,appellation,vintage,wine_type,color,location\n';

/** The CSV line of `barcode`, with the wine of its bottle when one has it. */
function barcodeLine(barcode: string, row: Partial<BarcodeRow> = {}): string {
    const fields = [
        barcode,
        row.wineName,
        row.producer,
        row.appellationName,
        row.vintage,
        row.typeName,
        row.colorName,
        row.storageCaseName
    ];
    return csvLine(fields) + '\n';
}

const csvOf = (rows: BarcodeRow[]) =>
    CSV_HEADER + rows.map((row) => barcodeLine(row.barcode ?? '', row)).join('');

const nothingToExport = () =>
    new ConflictError('nothing_to_export', 'No bottles with barcodes found');

/**
 * The bottles with a generated code of the configured prefix, for labels: GET
 * /api/barcode/export-all, the export of automatic barcodes.
 */
export function exportBarcodes(): CsvFile {
    const { autoGeneration, prefix } = getBarcodeSettings();
    if (!autoGeneration) throw barcodeGenerationOff();
    const rows = bottlesWithGeneratedBarcodes(prefix);
    if (rows.length === 0) throw nothingToExport();
    return { filename: `all_bottles_with_barcodes_${prefix}_${Date.now()}.csv`, csv: csvOf(rows) };
}

/** Every bottle with a barcode, whatever its prefix: GET /api/barcode/export-manual. */
export function exportManualBarcodes(): CsvFile {
    const rows = bottlesWithAnyBarcode();
    if (rows.length === 0) throw nothingToExport();
    return { filename: `all_bottles_with_manual_barcodes_${Date.now()}.csv`, csv: csvOf(rows) };
}

/**
 * The `count` codes from `startNumber`, with the wine of the bottles that already have one. The
 * prefix is the configured one with automatic barcodes, `requestedPrefix` otherwise.
 */
export function exportBarcodeRange(
    startNumber: number,
    count: number,
    requestedPrefix: string | null | undefined
): CsvFile {
    const prefix = labelPrefix(requestedPrefix);
    const barcodes = requestedBarcodeRange(prefix, startNumber, count);
    const bottles = new Map(bottlesWithBarcodes(barcodes).map((row) => [row.barcode, row]));
    return {
        filename: `barcodes_${prefix}_${startNumber}_${count}_${Date.now()}.csv`,
        csv:
            CSV_HEADER +
            barcodes.map((barcode) => barcodeLine(barcode, bottles.get(barcode))).join('')
    };
}
