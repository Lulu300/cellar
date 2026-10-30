import type { Locale } from '#lib/paraglide/runtime.js';

/** French writes the day first (dd/mm/yyyy), the other locales the month (mm/dd/yyyy). */
const dayFirst = (locale: Locale) => locale === 'fr';

/** The ISO date (yyyy-mm-dd) as `locale` writes it, or '' for no date. */
export function formatLocaleDate(iso: string, locale: Locale): string {
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    return dayFirst(locale) ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

/** The ISO date of a date written as `locale` writes it, or '' when the text is not one. */
export function parseLocaleDate(text: string, locale: Locale): string {
    const parts = text.trim().split('/');
    if (parts.length !== 3) return '';

    if (!parts.every((part) => /^\d{1,4}$/.test(part))) return '';
    const [day, month, year] = (dayFirst(locale) ? parts : [parts[1], parts[0], parts[2]]).map(
        Number
    );
    if (year < 1900 || year > 2100) return '';
    // A day the month lacks, such as 31/02, rolls over into the next month: refused, as the date
    // input that the form sends would be left empty.
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';

    const pad = (n: number, length: number) => n.toString().padStart(length, '0');
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * The date once the user has typed `text` in a field that held `current`: a text being typed is
 * not a date yet and must not clear the one the field holds, so only a complete date replaces it,
 * and only an empty field clears it.
 */
export function dateAfterInput(text: string, locale: Locale, current: string): string {
    if (!text) return '';
    return parseLocaleDate(text, locale) || current;
}
