/**
 * Reads a native form as the JSON API receives a body, so that the schemas of the API check the
 * forms too: the dialog before sending, the form action once it receives them. One reader and one
 * schema on both sides give the same validation (UI-06).
 *
 * A field the form lacks stays out of the result, so that a form that sends only the fields
 * changed reads as a partial update.
 */

/** The text of each field of `names` that the form has. */
export function formTexts(form: FormData, names: readonly string[]): Record<string, string> {
    return Object.fromEntries(
        names.flatMap((name) => {
            const value = form.get(name);
            return typeof value === 'string' ? [[name, value]] : [];
        })
    );
}

/** Digits with at most one decimal separator, a dot or a comma, and maybe a minus sign. */
const DECIMAL = /^-?(?:\d+[.,]?\d*|[.,]\d+)$/;

/**
 * The number that a field holds: null when left empty, the text itself when it is not a number,
 * for the schema to refuse it rather than read it as empty. A comma reads as a dot, whatever the
 * language of the browser (BUG-14); `Number()` alone would read "1e3", "0x10" or "Infinity".
 */
export function readNumber(text: string): number | string | null {
    const trimmed = text.trim();
    if (trimmed === '') return null;
    if (!DECIMAL.test(trimmed)) return text;
    // Enough digits overflow to Infinity, which JSON would send as null.
    const number = Number(trimmed.replace(',', '.'));
    return Number.isFinite(number) ? number : text;
}

/** The number of each field of `names` that the form has, as `readNumber` reads it. */
export function formNumbers(
    form: FormData,
    names: readonly string[]
): Record<string, number | string | null> {
    return Object.fromEntries(
        Object.entries(formTexts(form, names)).map(([name, text]) => [name, readNumber(text)])
    );
}

/** Every text value of a field that the form repeats, such as a list of grape varieties. */
export function formList(form: FormData, name: string): string[] {
    return form.getAll(name).filter((value) => typeof value === 'string');
}
