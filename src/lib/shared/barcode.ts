/**
 * The barcodes of the bottles: their format, and their Code 128 bars. The client, the server and
 * the PDF labels share this code, so that a code printed on a label is the one assigned.
 */

/**
 * Code 128 symbols by value: 1 is a bar module, 0 a space module. 0-102 are data, 103-105 the
 * start codes A, B and C, and 106 the stop pattern.
 */
const CODE128_PATTERNS = [
    '11011001100',
    '11001101100',
    '11001100110',
    '10010011000',
    '10010001100', // 0-4
    '10001001100',
    '10011001000',
    '10011000100',
    '10001100100',
    '11001001000', // 5-9
    '11001000100',
    '11000100100',
    '10110011100',
    '10011011100',
    '10011001110', // 10-14
    '10111001100',
    '10011101100',
    '10011100110',
    '11001110010',
    '11001011100', // 15-19
    '11001001110',
    '11011100100',
    '11001110100',
    '11101101110',
    '11101001100', // 20-24
    '11100101100',
    '11100100110',
    '11101100100',
    '11100110100',
    '11100110010', // 25-29
    '11011011000',
    '11011000110',
    '11000110110',
    '10100011000',
    '10001011000', // 30-34
    '10001000110',
    '10110001000',
    '10001101000',
    '10001100010',
    '11010001000', // 35-39
    '11000101000',
    '11000100010',
    '10110111000',
    '10110001110',
    '10001101110', // 40-44
    '10111011000',
    '10111000110',
    '10001110110',
    '11101110110',
    '11010001110', // 45-49
    '11000101110',
    '11011101000',
    '11011100010',
    '11011101110',
    '11101011000', // 50-54
    '11101000110',
    '11100010110',
    '11101101000',
    '11101100010',
    '11100011010', // 55-59
    '11101111010',
    '11001000010',
    '11110001010',
    '10100110000',
    '10100001100', // 60-64
    '10010110000',
    '10010000110',
    '10000101100',
    '10000100110',
    '10110010000', // 65-69
    '10110000100',
    '10011010000',
    '10011000010',
    '10000110100',
    '10000110010', // 70-74
    '11000010010',
    '11001010000',
    '11110111010',
    '11000010100',
    '10001111010', // 75-79
    '10100111100',
    '10010111100',
    '10010011110',
    '10111100100',
    '10011110100', // 80-84
    '10011110010',
    '11110100100',
    '11110010100',
    '11110010010',
    '11011011110', // 85-89
    '11011110110',
    '11110110110',
    '10101111000',
    '10100011110',
    '10001011110', // 90-94
    '10111101000',
    '10111100010',
    '11110101000',
    '11110100010',
    '10111011110', // 95-99
    '10111101110',
    '11101011110',
    '11110101110',
    '11010000100',
    '11010010000', // 100-104
    '11010011100',
    '1100011101011' // 105-106
];
const CODE128_START_B = 104;
const CODE128_STOP = 106;

/** White space kept on each side of the bars inside the padding, in mm, on every label. */
const BARCODE_QUIET_ZONE = 2;
/** Modules of white wanted on each side of the bars, as ISO/IEC 15417 asks. */
export const QUIET_ZONE_MODULES = 10;
/** Narrowest module, in mm, that labels may use: below it, labels are refused. */
export const MIN_MODULE_WIDTH = 0.33;

/**
 * Width in mm of one module of a code of `moduleCount` modules, centred on a label `labelWidth`
 * wide. It fits inside the padding and BARCODE_QUIET_ZONE, and leaves 10 modules of white on each
 * side counted from the label edge, because a label stuck on a dark bottle has no other white
 * around it. When 10 modules would bring a label under MIN_MODULE_WIDTH, the label keeps that
 * width and a slightly smaller quiet zone instead of being refused: labels valid before stay valid.
 */
export function code128ModuleWidth(moduleCount: number, labelWidth: number, padding: number) {
    const fitted = (labelWidth - 2 * padding - 2 * BARCODE_QUIET_ZONE) / moduleCount;
    const withQuietZones = labelWidth / (moduleCount + 2 * QUIET_ZONE_MODULES);
    return Math.min(fitted, Math.max(withQuietZones, MIN_MODULE_WIDTH));
}

/** The longest prefix: every code has BARCODE_LENGTH characters, and the prefix leaves 4 digits. */
const MAX_PREFIX_LENGTH = 6;

/** Whether `prefix`, which an old version may have saved, is too long to make any code. */
export const isPrefixTooLong = (prefix: string) => prefix.length > MAX_PREFIX_LENGTH;

export const INVALID_BARCODE_PREFIX_ERROR = 'Barcode prefix must be at most 6 letters, digits or -';

/**
 * Checks a barcode prefix on the server, and marks the prefix inputs aria-invalid. The prefix
 * also ends up in download file names: the strict character set keeps separators and quotes out.
 */
export function isValidBarcodePrefix(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        new RegExp(`^[A-Za-z0-9-]{0,${MAX_PREFIX_LENGTH}}$`).test(value)
    );
}

/**
 * A barcode as the database keeps it: trimmed, and null when blank, as the unique index would take
 * each blank one for the same barcode. Any other value, such as undefined for a field left out, is
 * returned as it is.
 */
export function storedBarcode<T>(value: T): T | string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return value;
    return String(value).trim() || null;
}

/** Length of every new sequential barcode: the prefix, then the number padded with zeros. */
export const BARCODE_LENGTH = 10;

/**
 * Length of the sequential barcodes generated before September 2025, with the number padded the
 * same way. Old databases and backups still hold them, and their numbers are printed on labels.
 */
export const LEGACY_BARCODE_LENGTH = 13;

/** The largest number that fits after `prefix`. */
export function maxBarcodeNumber(prefix: string): number {
    return 10 ** (BARCODE_LENGTH - prefix.length) - 1;
}

/** Thrown when a number does not fit after its prefix: cutting it would repeat an earlier code. */
export class BarcodeRangeError extends RangeError {
    constructor(prefix: string, number: number) {
        super(
            `Barcode number ${number} is out of range: with prefix "${prefix}", numbers go from 1 to ${maxBarcodeNumber(prefix)}`
        );
        this.name = 'BarcodeRangeError';
    }
}

/** Thrown for a prefix longer than 6 characters, which an old database or backup may hold. */
export class BarcodePrefixTooLongError extends Error {
    constructor(prefix: string) {
        super(`Barcode prefix "${prefix}" is longer than 6 characters`);
        this.name = 'BarcodePrefixTooLongError';
    }
}

/**
 * The sequential barcode `number` of `prefix`. The client, the server and the PDF all use it, so
 * that a code printed on a label is the one assigned to the bottle.
 */
export function formatBarcode(prefix: string, number: number): string {
    if (isPrefixTooLong(prefix)) throw new BarcodePrefixTooLongError(prefix);
    if (!Number.isInteger(number) || number < 0 || number > maxBarcodeNumber(prefix)) {
        throw new BarcodeRangeError(prefix, number);
    }
    return prefix + number.toString().padStart(BARCODE_LENGTH - prefix.length, '0');
}

/** The `count` sequential barcodes of `prefix` from `start`, as the CSV and the PDF list them. */
export function formatBarcodeRange(prefix: string, start: number, count: number): string[] {
    return Array.from({ length: count }, (_, i) => formatBarcode(prefix, start + i));
}

/** Thrown for a code that Code 128 B cannot encode, rather than printing a wrong barcode. */
export class Code128EncodingError extends Error {
    constructor(data: string) {
        super(
            `Code 128 cannot encode "${data}": only ASCII characters from space to ~ are supported`
        );
        this.name = 'Code128EncodingError';
    }
}

/**
 * The bars of `data` in Code 128 set B, quiet zones excluded: start code, data, checksum and stop
 * pattern, one character per module (1 for a bar, 0 for a space).
 */
export function generateCODE128Pattern(data: string): string {
    const values = [CODE128_START_B];
    let checksum = CODE128_START_B;
    for (let i = 0; i < data.length; i++) {
        const ascii = data.charCodeAt(i);
        if (ascii < 32 || ascii > 126) throw new Code128EncodingError(data);
        values.push(ascii - 32);
        checksum += (ascii - 32) * (i + 1);
    }
    values.push(checksum % 103, CODE128_STOP);
    return values.map((value) => CODE128_PATTERNS[value]).join('');
}

/** A bar of a Code 128 pattern: its first module, and its width in modules. */
export interface Code128Bar {
    start: number;
    width: number;
}

/**
 * The bars of `data` in Code 128 set B, left to right, and its width in modules. One rectangle per
 * bar: rectangles of adjacent modules could render with hairline gaps.
 */
export function code128Bars(data: string): { bars: Code128Bar[]; moduleCount: number } {
    const pattern = generateCODE128Pattern(data);
    const bars = [...pattern.matchAll(/1+/g)].map((bar) => ({
        start: bar.index,
        width: bar[0].length
    }));
    return { bars, moduleCount: pattern.length };
}

// Finding bottles by their barcode, typed or scanned: the wine list, the bulk entry and the MCP
// server search the same way.

/**
 * The bottles whose barcode is `code` as typed, capitals included; failing that, the bottles whose
 * barcode is `code` in other capitals. Two codes may differ only by their case (the prefixes `cv`
 * and `CV` are both allowed), and a scanned code then finds its one bottle. Each search adds its
 * own last fallback when this finds none.
 */
export function findSameBarcode<B extends { barcode: string | null }>(
    bottles: B[],
    code: string
): B[] {
    const exact = bottles.filter((bottle) => bottle.barcode === code);
    if (exact.length > 0) return exact;
    const term = code.toLowerCase();
    return bottles.filter((bottle) => bottle.barcode?.toLowerCase() === term);
}

/** findSameBarcode, else the bottles whose code, in any case, passes `fallback` for `code`. */
function findSameBarcodeOr<B extends { barcode: string }>(
    bottles: B[],
    code: string,
    fallback: (barcode: string, term: string) => boolean
): B[] {
    const same = findSameBarcode(bottles, code);
    if (same.length > 0) return same;
    const term = code.toLowerCase();
    return bottles.filter((bottle) => fallback(bottle.barcode.toLowerCase(), term));
}

/** findSameBarcode, else the bottles whose code ends with `code`: typing the end is enough. */
export function findBarcodeMatches<B extends { barcode: string }>(bottles: B[], code: string): B[] {
    return findSameBarcodeOr(bottles, code, (barcode, term) => barcode.endsWith(term));
}

/** findSameBarcode, else the bottles whose code contains `code`: the search of the wine list. */
export function searchBarcode<B extends { barcode: string }>(bottles: B[], code: string): B[] {
    return findSameBarcodeOr(bottles, code, (barcode, term) => barcode.includes(term));
}
