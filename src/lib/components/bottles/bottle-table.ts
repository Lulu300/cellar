import { defaultDirection } from '#lib/shared/schemas/bottle-list.js';
import { m } from '#lib/paraglide/messages.js';
import type { BottleSort, SortColumn } from '#lib/utils/bottle-sort.js';

/**
 * The columns of a bottle table: the sorted ones, the notes, when to drink the bottle, and how
 * many bottles a row holds.
 */
export type BottleColumn = SortColumn | 'notes' | 'drinking' | 'count';

/** The sort after a click on the header of `column`: the other direction, or its default one. */
export function nextSort(sort: BottleSort, column: SortColumn): BottleSort {
    if (sort.column !== column) return { column, direction: defaultDirection(column) };
    return { column, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
}

/** A bottle in a list of bottles of several wines: the name of its wine, then its vintage. */
export function bottleName(bottle: {
    vintage: number | null;
    definition?: { name: string } | null;
}): string {
    const name = bottle.definition?.name || m['common.not_available']();
    return [name, bottle.vintage].filter((part) => part !== null).join(' ');
}
