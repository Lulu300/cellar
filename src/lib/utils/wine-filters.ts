import { z } from 'zod';
import { ownedBottles, WINE_GROUP_SORT_KEYS } from '#lib/utils/wine-group-sort.js';

/** The fields of a bottle that the filters of the wine list read. */
interface FilterBottle {
    availability?: string | null;
    vintage?: number | null;
    origin?: { id: string } | null;
}

// Like the card, which counts, dates and prices only the bottles still owned, each filter reads
// only those. The wine list already loads only those; GET /api/wines keeps the consumed ones.

const BOTTLE_COUNT_MODES = ['', 'none', 'exact', 'at_least', 'less_than'] as const;
export type BottleCountMode = (typeof BOTTLE_COUNT_MODES)[number];

const WINE_LIST_VIEWS = ['cards', 'list'] as const;
export type WineListView = (typeof WINE_LIST_VIEWS)[number];

const VINTAGE_MODES = ['', 'no_vintage', 'range'] as const;
export type VintageMode = (typeof VINTAGE_MODES)[number];

/** Whether the number of bottles still owned passes the bottle-count filter. */
export function matchesBottleCount(
    bottles: FilterBottle[],
    mode: BottleCountMode,
    count: number
): boolean {
    const owned = ownedBottles(bottles).length;
    switch (mode) {
        case 'none':
            return owned === 0;
        case 'exact':
            return owned === count;
        case 'at_least':
            return owned >= count;
        case 'less_than':
            return owned < count;
        default:
            return true;
    }
}

/**
 * Whether a bottle still owned has no vintage ('no_vintage'), or one between `min` and `max`
 * ('range'; null leaves a bound open).
 */
export function matchesVintage(
    bottles: FilterBottle[],
    mode: VintageMode,
    min: number | null,
    max: number | null
): boolean {
    if (mode === 'no_vintage')
        return ownedBottles(bottles).some((bottle) => bottle.vintage == null);
    if (mode !== 'range' || (min === null && max === null)) return true;
    return ownedBottles(bottles).some(
        ({ vintage }) =>
            vintage != null && (min === null || vintage >= min) && (max === null || vintage <= max)
    );
}

/** Whether a bottle still owned comes from this origin. */
export function matchesOrigin(bottles: FilterBottle[], originId: string): boolean {
    return ownedBottles(bottles).some((bottle) => bottle.origin?.id === originId);
}

/**
 * The search, filters, sort and view of the wine list, as its URL holds them
 * (`?search=&region=&sort=` and so on): a missing or invalid value gives its default, so that any
 * URL shows the list. The references are ids, so that two regions of the same name in two
 * countries stay apart. Without a view chosen on the page (''), the preference gives it.
 */
const wineListQuerySchema = z.object({
    search: z.string().catch(''),
    type: z.string().catch(''),
    color: z.string().catch(''),
    region: z.string().catch(''),
    country: z.string().catch(''),
    origin: z.string().catch(''),
    vintage: z.enum(VINTAGE_MODES).catch(''),
    from: z.string().catch(''),
    to: z.string().catch(''),
    bottles: z.enum(BOTTLE_COUNT_MODES).catch(''),
    count: z.string().catch('1'),
    sort: z.enum(WINE_GROUP_SORT_KEYS).catch('name'),
    dir: z.enum(['asc', 'desc']).catch('asc'),
    view: z.enum(['', ...WINE_LIST_VIEWS]).catch('')
});

export type WineListQuery = z.output<typeof wineListQuerySchema>;

const DEFAULT_QUERY = wineListQuerySchema.parse({});

export function readWineListQuery(params: Iterable<[string, string]>): WineListQuery {
    return wineListQuerySchema.parse(Object.fromEntries(params));
}

/** The URL parameters of these changes: a value back to its default leaves the URL. */
export function wineListParams(changes: Partial<WineListQuery>): Record<string, string | null> {
    return Object.fromEntries(
        Object.entries(changes).map(([name, value]) => [
            name,
            value === DEFAULT_QUERY[name as keyof WineListQuery] ? null : value
        ])
    );
}

/** The fields of a wine that the filters of the wine list read. */
interface FilterWine {
    definition: {
        name: string;
        producer: string | null;
        appellationName: string;
        typeId: string;
        colorId: string;
        appellation: { regionId: string; region: { countryId: string } | null } | null;
    };
    bottles: FilterBottle[];
}

/** The wines that pass the search and every filter of `query`. */
export function filterWines<W extends FilterWine>(wines: W[], query: WineListQuery): W[] {
    const search = query.search.toLowerCase();
    const count = parseInt(query.count, 10) || 0;
    const from = parseInt(query.from, 10) || null;
    const to = parseInt(query.to, 10) || null;

    return wines.filter(
        ({ definition: wine, bottles }) =>
            (!search ||
                [wine.name, wine.producer, wine.appellationName].some((text) =>
                    text?.toLowerCase().includes(search)
                )) &&
            (!query.type || wine.typeId === query.type) &&
            (!query.color || wine.colorId === query.color) &&
            (!query.region || wine.appellation?.regionId === query.region) &&
            (!query.country || wine.appellation?.region?.countryId === query.country) &&
            (!query.origin || matchesOrigin(bottles, query.origin)) &&
            matchesBottleCount(bottles, query.bottles, count) &&
            matchesVintage(bottles, query.vintage, from, to)
    );
}
