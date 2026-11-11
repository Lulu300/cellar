import { parse } from 'csv-parse/sync';
import { withoutFormulaGuard } from '#lib/shared/csv.js';

/** A line of a CSV file, by the columns of its header, every value trimmed. */
export type CsvRecord = Record<string, string>;

/**
 * A line with more or fewer values than the header has columns: it is reported, not read. Its values
 * are kept for the rows that the user leaves out to download.
 */
export class UnevenLine {
    constructor(
        readonly values: string[],
        readonly columns: number
    ) {}
}

export type CsvLines = { header: string[]; lines: (CsvRecord | UnevenLine)[] };

/**
 * The header of a CSV file and the lines under it, each value without the guard that an export puts
 * before a text that a spreadsheet would run as a formula. Throws when the file is not valid CSV.
 */
export function parseCsv(text: string, delimiter: string): CsvLines {
    const [header = [], ...lines]: string[][] = parse(text, {
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter,
        cast: withoutFormulaGuard,
        // A line of another length is reported alone, instead of the whole file.
        relax_column_count: true
    });
    return {
        header,
        lines: lines.map((values) =>
            values.length === header.length
                ? Object.fromEntries(header.map((column, i) => [column, values[i]]))
                : new UnevenLine(values, header.length)
        )
    };
}

const NUMBER_COLUMNS = new Set([
    'capacity',
    'position',
    'rating',
    'targetQuantity',
    'vintage',
    'optimum',
    'purchasePrice',
    'currentValue'
]);

/**
 * A decimal number with a point or a comma, as a spreadsheet may write it; any other text, such as
 * "NV" or "0x10", as it is, for the row schema to refuse.
 */
function numberOrText(text: string): number | string {
    return /^-?\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : text;
}

export const isIdColumn = (column: string) => /(^id|Id)$/.test(column);

/**
 * The values of a record as the row schemas read them. Blank values are left out, and so are ids:
 * a file names the rows it refers to, as their ids differ from one cellar to another.
 */
export function csvValues(record: CsvRecord): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(record)
            .filter(([column, text]) => text !== '' && !isIdColumn(column))
            .map(([column, text]) => [
                column,
                NUMBER_COLUMNS.has(column) ? numberOrText(text) : text
            ])
    );
}
