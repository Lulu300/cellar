// A spreadsheet runs a cell that starts with one of these as a formula: an exported note such as
// `=HYPERLINK(...)` would run when the file is opened (CSV injection). OWASP's advice is followed:
// such a text gets a leading `'`, which spreadsheets show as text, and is quoted.
const FORMULA_START = /^[=+\-@\t\r]/;
const FORMULA_GUARD = "'";
// A guarded text, or one that the user started with apostrophes: an import removes one of them.
const GUARDED = /^'+[=+\-@\t\r]/;
// Letters, digits and dashes after a sign, such as a barcode of the prefix "-AB": a spreadsheet
// can at most compute it, never call a function or another program, and the label software that
// reads the barcode CSV files needs the code unchanged.
const PLAIN_CODE = /^[+-]?[A-Za-z0-9-]+$/;

function cellText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.join('; ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function needsGuard(value: unknown, text: string): boolean {
    // A number such as -5 is read as a number, not a formula.
    if (typeof value === 'number') return false;
    if (FORMULA_START.test(text)) return !PLAIN_CODE.test(text);
    // A text that starts like a guarded one, such as '=x, keeps its apostrophe through an import.
    return GUARDED.test(text);
}

/**
 * A value as a CSV field: arrays joined with `; `, dates in ISO 8601, a text that a spreadsheet
 * would run as a formula guarded, and quoted when it holds the delimiter, a quote or a line break.
 */
export function csvField(value: unknown, delimiter = ','): string {
    let text = cellText(value);
    const guarded = needsGuard(value, text);
    if (guarded) text = FORMULA_GUARD + text;
    return guarded || /["\r\n]/.test(text) || text.includes(delimiter)
        ? `"${text.replaceAll('"', '""')}"`
        : text;
}

/** The fields of one CSV line, without the line break. */
export function csvLine(values: unknown[], delimiter = ','): string {
    return values.map((value) => csvField(value, delimiter)).join(delimiter);
}

/** The text that csvField guarded, as it was before; any other text as it is. */
export function withoutFormulaGuard(text: string): string {
    return GUARDED.test(text) ? text.slice(FORMULA_GUARD.length) : text;
}
