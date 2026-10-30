import { z } from 'zod';

/** The columns that the bottle tables sort on. */
export type BottleSortColumn =
    | 'definition'
    | 'location'
    | 'origin'
    | 'availability'
    | 'format'
    | 'barcode'
    | 'purchasePrice'
    | 'purchaseDate'
    | 'consumedDate';
export type SortDirection = 'asc' | 'desc';

/** The numbers of bottles that a page of a bottle table can show. */
export const PAGE_SIZES = [25, 50, 75, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

/** A date sorts the newest first, any other column from its lowest value. */
export function defaultDirection(column: string): SortDirection {
    return column === 'purchaseDate' || column === 'consumedDate' ? 'desc' : 'asc';
}

/**
 * Reads the sort, page and page size of a bottle table from its URL: `?sort=&dir=&page=&perPage=`.
 * A missing or invalid value gives its default, so that any URL shows a page rather than an
 * error. Only `columns`, those the table shows, are accepted for the sort; the direction asked
 * goes with the column asked, so the default sort takes its own direction, also when the URL gives
 * `dir` without `sort`.
 */
export function parseBottlePageQuery<Column extends BottleSortColumn>(
    params: URLSearchParams,
    columns: readonly [Column, ...Column[]],
    defaultSort: Column
) {
    const schema = z.object({
        sort: z.enum(columns).catch(defaultSort),
        dir: z.enum(['asc', 'desc']).optional().catch(undefined),
        page: z.coerce.number().int().min(1).catch(1),
        perPage: z.coerce
            .number()
            .refine((size) => (PAGE_SIZES as readonly number[]).includes(size))
            .catch(DEFAULT_PAGE_SIZE)
    });
    const { sort, dir, page, perPage } = schema.parse(Object.fromEntries(params));
    const direction = (params.get('sort') === sort && dir) || defaultDirection(sort);
    return { sort, direction, page, perPage };
}
