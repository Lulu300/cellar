import { z } from 'zod';
import { m } from '#lib/paraglide/messages.js';
import { TO_DRINK, type DrinkingRank } from '#lib/shared/drinking.js';
import { parsePageQuery, type QueryParams } from '#lib/shared/schemas/bottle-list.js';
import { compareText } from '#lib/utils/compare.js';
import { changedParams } from '#lib/utils/pagination.js';

/** What the page of the bottles to drink reads of a bottle, beyond what its table shows. */
export interface ToDrinkBottle {
    id: string;
    vintage: number | null;
    optimum: number | null;
    rank: DrinkingRank;
    storageCase: { name: string } | null;
    definition: {
        id: string;
        name: string;
        producer: string | null;
        colorId: string;
        color: string;
        colorHex: string;
    };
}

/** The columns of the page, in their order, which it sorts on: how urgent by default. */
export const TO_DRINK_COLUMNS = [
    'definition',
    'color',
    'vintage',
    'urgency',
    'optimum',
    'drinkBefore',
    'location'
] as const;

/** The columns of the view by wine: those, and how many bottles a row holds after the vintage. */
export const WINE_ROW_COLUMNS = [
    ...TO_DRINK_COLUMNS.slice(0, 3),
    'count',
    ...TO_DRINK_COLUMNS.slice(3)
] as const;

/** One row per bottle, or one per wine and vintage. */
const TO_DRINK_VIEWS = ['bottle', 'wine'] as const;

const filtersSchema = z.object({
    view: z.enum(TO_DRINK_VIEWS).catch('bottle'),
    // Empty for every rank or colour
    rank: z.enum(['', ...TO_DRINK] as ['', ...DrinkingRank[]]).catch(''),
    color: z.string().catch(''),
    search: z.string().catch('')
});

type ToDrinkChoices = z.output<typeof filtersSchema>;
export type ToDrinkFilters = Omit<ToDrinkChoices, 'view'>;

const DEFAULT_CHOICES = filtersSchema.parse({});

/** The URL parameters of a new view or filter: a value back to its default leaves the URL. */
export const toDrinkParams = (changes: Partial<ToDrinkChoices>) =>
    changedParams(changes, DEFAULT_CHOICES);

/**
 * The view, filters, sort and page of the page, as its URL holds them
 * (`?view=wine&rank=late&color=<id>&search=&sort=optimum&dir=asc&page=2&perPage=50`), so that a
 * reload or the way back finds them. A missing or invalid value gives its default.
 */
export function readToDrinkQuery(params: QueryParams) {
    return {
        ...filtersSchema.parse(Object.fromEntries(params)),
        ...parsePageQuery(params, TO_DRINK_COLUMNS, 'urgency')
    };
}

/**
 * The filters of `query` that the list can show: a colour that no bottle has any more, its last
 * one drunk, has no chip to clear it, so it filters nothing.
 */
export function shownFilters<B extends ToDrinkBottle>(
    bottles: B[],
    { rank, color, search }: ToDrinkFilters
): ToDrinkFilters {
    const known = bottles.some(({ definition }) => definition.colorId === color);
    return { rank, color: known ? color : '', search };
}

/** The bottles of this rank and colour whose wine's name or producer holds the search. */
export function filterToDrink<B extends ToDrinkBottle>(
    bottles: B[],
    { rank, color, search }: ToDrinkFilters
): B[] {
    const text = search.trim().toLowerCase();
    return bottles.filter(
        ({ rank: bottleRank, definition }) =>
            (!rank || bottleRank === rank) &&
            (!color || definition.colorId === color) &&
            (!text ||
                [definition.name, definition.producer].some((field) =>
                    field?.toLowerCase().includes(text)
                ))
    );
}

/**
 * The choices of the rank and colour filters, each with the number of bottles that the other
 * filters leave it, so that a choice says what it would show. Only the ranks and colours of the
 * list are offered, and the rank chosen, which its bottles may have left, so that it can be
 * cleared: the ranks the most urgent first, the colours by name.
 */
export function filterChoices<B extends ToDrinkBottle>(bottles: B[], filters: ToDrinkFilters) {
    const count = <Value extends string>(values: Value[], shown: Value[]) =>
        [...new Set(values)].map((value) => ({
            value,
            count: shown.filter((other) => other === value).length
        }));
    const ranks = count(
        TO_DRINK.filter(
            (rank) => rank === filters.rank || bottles.some((bottle) => bottle.rank === rank)
        ),
        filterToDrink(bottles, { ...filters, rank: '' }).map((bottle) => bottle.rank)
    );
    const colors = count(
        bottles
            .map(({ definition }) => definition)
            .sort((a, b) => compareText(a.color, b.color))
            .map((definition) => definition.colorId),
        filterToDrink(bottles, { ...filters, color: '' }).map((bottle) => bottle.definition.colorId)
    );
    return { ranks, colors };
}

/** The bottles of one wine and vintage, on one row of the « by wine » view. */
export type WineRow<B extends ToDrinkBottle> = Omit<B, 'storageCase'> & {
    /** The wine and the vintage, which no bottle shares with another row. */
    id: string;
    count: number;
    bottles: B[];
    /** The cases that hold its bottles: the first two, then how many others. */
    storageCase: { name: string } | null;
};

/** Cases named in a row, by name: the first two, then « +N » for the others (« Cave1, Cave4 +1 »). */
function caseNames(cases: string[]): string {
    const named = cases.slice(0, 2).join(', ');
    return cases.length > 2
        ? m['drinking.more_cases']({ cases: named, count: cases.length - 2 })
        : named;
}

/**
 * One row per wine and vintage, in the order of the first bottle of each: given the bottles the
 * most urgent first, as the server lists them, each row takes the rank and the drinking window of
 * its most urgent bottle, the oldest optimum of its bottles, and names the cases that hold them.
 */
export function groupByWine<B extends ToDrinkBottle>(bottles: B[]): WineRow<B>[] {
    const groups = new Map<string, B[]>();
    for (const bottle of bottles) {
        const key = `${bottle.definition.id}:${bottle.vintage ?? ''}`;
        groups.set(key, [...(groups.get(key) ?? []), bottle]);
    }
    return [...groups].map(([id, group]) => {
        const cases = [...new Set(group.flatMap(({ storageCase }) => storageCase?.name ?? []))];
        const optima = group.flatMap(({ optimum }) => optimum ?? []);
        return {
            ...group[0],
            id,
            count: group.length,
            bottles: group,
            optimum: optima.length > 0 ? Math.min(...optima) : null,
            storageCase: cases.length > 0 ? { name: caseNames(cases.sort(compareText)) } : null
        };
    });
}
