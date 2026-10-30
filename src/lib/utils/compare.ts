import type { SortDirection } from '#lib/shared/schemas/bottle-list.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Orders text by the rules of the language: an accent or a lowercase letter does not go after Z. */
export function compareText(a: string, b: string): number {
    return collator.compare(a, b);
}

/**
 * Orders two values of a column in `direction`: text with compareText, numbers by value. A missing
 * value (null) goes last in both directions.
 */
export function compareValues(
    a: string | number | null,
    b: string | number | null,
    direction: SortDirection
): number {
    if (a === null || b === null) return Number(a === null) - Number(b === null);
    const order =
        typeof a === 'string' && typeof b === 'string' ? compareText(a, b) : Number(a) - Number(b);
    return direction === 'asc' ? order : -order;
}

/**
 * Whether another item of `items` has the same name as `item`, capitals and accents aside: two
 * regions of one name in two countries then show their country.
 */
export function nameIsShared<T extends { id: string }>(
    items: T[],
    item: T,
    name: (item: T) => string
): boolean {
    return items.some(
        (other) => other.id !== item.id && compareText(name(other), name(item)) === 0
    );
}
