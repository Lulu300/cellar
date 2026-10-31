import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';

/** A date as the API and the load functions give it: a Date, or its JSON string. */
type DateValue = Date | string | number | null | undefined;

const notAvailable = () => m['common.not_available']();

/**
 * A stored day in the language of the interface: "Oct 13, 2026", "13 oct. 2026"; N/A without one.
 * The server stores a day as its midnight in UTC, so the day is read in UTC too (as `isoDate`):
 * west of UTC, the local time of that midnight is the day before. A moment, such as when a file
 * changed, takes `formatDateTime`.
 */
export function formatDate(value: DateValue): string {
    if (value == null || value === '') return notAvailable();
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value)
    );
}

/** A day and a time in the language of the interface; N/A without one. */
export function formatDateTime(value: DateValue): string {
    if (value == null || value === '') return notAvailable();
    return new Intl.DateTimeFormat(getLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

/**
 * An amount in euros in the language of the interface: "€12.00", "12,00 €"; N/A without one.
 * `wholeEuros` drops the cents, for the totals.
 */
export function formatCurrency(
    amount: number | null | undefined,
    { wholeEuros = false } = {}
): string {
    if (amount == null) return notAvailable();
    return new Intl.NumberFormat(getLocale(), {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: wholeEuros ? 0 : 2,
        maximumFractionDigits: wholeEuros ? 0 : 2
    }).format(amount);
}

/** "min - max (average)" of some prices, or the price when they are all the same; N/A without. */
export function formatPriceRange(prices: { min: number; max: number; avg: number } | null): string {
    if (!prices) return notAvailable();
    if (prices.min === prices.max) return formatCurrency(prices.min);
    const { min, max, avg } = prices;
    return `${formatCurrency(min)} - ${formatCurrency(max)} (${formatCurrency(avg)})`;
}

/** The vintages of some bottles, "2015" or "2015-2020"; N/A without one. */
export function formatVintageRange(range: { oldest: number; newest: number } | null): string {
    if (!range) return notAvailable();
    return range.oldest === range.newest ? String(range.oldest) : `${range.oldest}-${range.newest}`;
}

/**
 * A rating out of five as stars, "★★★☆☆", or "No rating" for none or 0. A half point, which the
 * form allows, rounds to the nearest star: there is no half star to draw.
 */
export function formatRating(rating: number | null | undefined): string {
    if (!rating) return m['common.no_rating']();
    const stars = Math.min(Math.max(Math.round(rating), 0), 5);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/** A whole percentage in the language of the interface: "50%", "50 %". */
export function formatPercent(percent: number): string {
    return new Intl.NumberFormat(getLocale(), {
        style: 'percent',
        maximumFractionDigits: 0
    }).format(percent / 100);
}

/** A number in the language of the interface, grouped: "10,000", "10 000". */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
}

/**
 * A number as a number field shows it, in the language of the interface: "12.5", "12,5"; empty
 * for none. Without grouping, which readNumber would refuse to read back.
 */
export function formatInputNumber(value: number | null | undefined): string {
    if (value == null) return '';
    return new Intl.NumberFormat(getLocale(), {
        useGrouping: false,
        maximumFractionDigits: 20
    }).format(value);
}

const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];

/** A size in bytes in the language of the interface: "1.5 MB", "1,5 Mo", "120 bytes". */
export function formatFileSize(bytes: number): string {
    const exponent =
        bytes > 0
            ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1)
            : 0;
    return new Intl.NumberFormat(getLocale(), {
        style: 'unit',
        unit: SIZE_UNITS[exponent],
        // "120 byte" reads wrong: bytes are spelt out, the larger units abbreviated.
        unitDisplay: exponent === 0 ? 'long' : 'short',
        maximumFractionDigits: 1
    }).format(bytes / 1024 ** exponent);
}

/**
 * Today in the local time of the browser, or of the server, as YYYY-MM-DD: the value of a date
 * input. Not `toISOString()`, which gives the day in UTC: the day before between midnight and 2 am
 * in Paris.
 */
export function today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The day of a stored date as YYYY-MM-DD, the value of a date input. The server stores a day as
 * its midnight in UTC, so the day is read in UTC too.
 */
export function isoDate(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 10);
}
