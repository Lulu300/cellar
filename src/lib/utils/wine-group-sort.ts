import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { SortDirection } from '#lib/shared/schemas/bottle-list.js';
import { compareText, compareValues } from '#lib/utils/compare.js';

/** The fields of a bottle that the wine list aggregates over. */
interface GroupBottle {
    availability?: string | null;
    vintage?: number | null;
    purchasePrice?: number | null;
}

/** A wine definition with its bottles, as the wine list shows it on one card. */
export interface SortableWineGroup {
    definition: { name?: string | null; producer?: string | null; rating?: number | null };
    bottles: GroupBottle[];
}

/** The bottles still owned: consumed ones only stay in a group for the history. */
export function ownedBottles<T extends GroupBottle>(bottles: T[]): T[] {
    return bottles.filter(
        (bottle) =>
            bottle.availability === BottleAvailability.AVAILABLE ||
            bottle.availability === BottleAvailability.OUT_OF_CELLAR
    );
}

/** Oldest and newest vintage of the bottles still owned, or null when none has a vintage. */
export function vintageRange(bottles: GroupBottle[]) {
    const vintages = ownedBottles(bottles)
        .map((bottle) => bottle.vintage)
        .filter((vintage): vintage is number => vintage != null);
    if (vintages.length === 0) return null;
    return { oldest: Math.min(...vintages), newest: Math.max(...vintages) };
}

/** Purchase price statistics of the bottles still owned, or null when none has a price. */
export function priceStats(bottles: GroupBottle[]) {
    const prices = ownedBottles(bottles)
        .map((bottle) => bottle.purchasePrice)
        .filter((price): price is number => price != null && price > 0);
    if (prices.length === 0) return null;
    return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((sum, price) => sum + price, 0) / prices.length
    };
}

const text = (value: string | null | undefined) => value?.trim() || null;

// A card shows a whole definition, so each key names the value that stands for its bottles.
// null marks a wine without a value, which is listed last in both directions.
const sortValues = {
    name: (group: SortableWineGroup) => text(group.definition.name),
    producer: (group: SortableWineGroup) => text(group.definition.producer),
    vintage: (group: SortableWineGroup) => vintageRange(group.bottles)?.oldest ?? null,
    price: (group: SortableWineGroup) => priceStats(group.bottles)?.avg ?? null,
    // The card shows a rating of 0 as "No rating".
    rating: (group: SortableWineGroup) => group.definition.rating || null,
    bottles: (group: SortableWineGroup) => ownedBottles(group.bottles).length
};

export type WineGroupSortKey = keyof typeof sortValues;
export const WINE_GROUP_SORT_KEYS = Object.keys(sortValues) as [
    WineGroupSortKey,
    ...WineGroupSortKey[]
];

/** Returns a sorted copy of the groups; ties keep the name order, so the list stays stable. */
export function sortWineGroups<T extends SortableWineGroup>(
    groups: T[],
    key: WineGroupSortKey,
    direction: SortDirection
): T[] {
    const sortValue: (group: SortableWineGroup) => string | number | null = sortValues[key];
    const byName = (a: T, b: T) => compareText(a.definition.name ?? '', b.definition.name ?? '');

    return groups
        .map((group) => ({ group, value: sortValue(group) }))
        .sort((a, b) => compareValues(a.value, b.value, direction) || byName(a.group, b.group))
        .map(({ group }) => group);
}
