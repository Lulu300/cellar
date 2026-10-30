import type { BottleSortColumn, SortDirection } from '#lib/shared/schemas/bottle-list.js';
import { compareValues } from '#lib/utils/compare.js';

/** The fields of a bottle that the bottle tables show and sort on. */
export interface TableBottle {
    id: string;
    availability: string;
    vintage: number | null;
    format: string | null;
    purchaseDate: Date | string | null;
    consumedDate?: Date | string | null;
    purchasePrice: number | null;
    barcode: string | null;
    notes: string | null;
    storageCase?: { name: string } | null;
    origin?: { name: string } | null;
    definition?: { id: string; name: string; producer: string | null } | null;
}

/** The columns that the bottle tables sort on: those of the server, and the vintage. */
export type SortColumn = BottleSortColumn | 'vintage';

export interface BottleSort {
    column: SortColumn;
    direction: SortDirection;
}

const text = (value: string | null | undefined) => value?.trim() || null;
const time = (value: Date | string | null | undefined) =>
    value ? new Date(value).getTime() : null;

const sortValues: Record<SortColumn, (bottle: TableBottle) => string | number | null> = {
    definition: (bottle) => text(bottle.definition?.name),
    location: (bottle) => text(bottle.storageCase?.name),
    origin: (bottle) => text(bottle.origin?.name),
    availability: (bottle) => bottle.availability,
    format: (bottle) => text(bottle.format),
    barcode: (bottle) => text(bottle.barcode),
    vintage: (bottle) => bottle.vintage,
    purchasePrice: (bottle) => bottle.purchasePrice,
    purchaseDate: (bottle) => time(bottle.purchaseDate),
    consumedDate: (bottle) => time(bottle.consumedDate)
};

/**
 * Returns the bottles sorted, in the same order in every bottle table, on the server as in the
 * browser. Text follows the rules of the language, and a bottle without a value goes last in both
 * directions. The sort is stable: bottles that sort the same keep the order they are given in.
 */
export function sortBottles<B extends TableBottle>(
    bottles: B[],
    { column, direction }: BottleSort
) {
    const value = sortValues[column];
    return [...bottles].sort((a, b) => compareValues(value(a), value(b), direction));
}
