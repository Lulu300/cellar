import { drinkBeforeMonth, monthOf, urgency, type DrinkingDates } from '#lib/shared/drinking.js';
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
    /** For the columns of when to drink it, which only the lists that show them need. */
    drinkBefore?: string | null;
    optimum?: number | null;
    storageCase?: { name: string } | null;
    /** The bottles of a row that holds several, such as one per wine. */
    count?: number;
    origin?: { name: string } | null;
    definition?: {
        id: string;
        name: string;
        producer: string | null;
        color: string;
        colorHex: string;
    } | null;
}

/**
 * The columns that the bottle tables sort on: those of the server, the vintage, and those of the
 * bottles to drink: how urgent, the optimum year, the « drink before » and the colour of the wine.
 */
export type SortColumn =
    BottleSortColumn | 'vintage' | 'urgency' | 'optimum' | 'drinkBefore' | 'color';

export interface BottleSort {
    column: SortColumn;
    direction: SortDirection;
}

/** What the rule of when to drink reads of a bottle, null for a field the list does not give. */
export const drinkingDates = (bottle: TableBottle): DrinkingDates => ({
    drinkBefore: bottle.drinkBefore ?? null,
    optimum: bottle.optimum ?? null
});

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
    consumedDate: (bottle) => time(bottle.consumedDate),
    // In the browser's month, as the chips of the table rank the bottles
    urgency: (bottle) => urgency(drinkingDates(bottle), monthOf(new Date())),
    optimum: (bottle) => bottle.optimum ?? null,
    drinkBefore: (bottle) => (bottle.drinkBefore ? drinkBeforeMonth(bottle.drinkBefore) : null),
    color: (bottle) => text(bottle.definition?.color)
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
