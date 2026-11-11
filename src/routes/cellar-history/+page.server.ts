import { z } from 'zod';
import { listBottlePage } from '#lib/server/features/bottles/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { parsePageQuery } from '#lib/shared/schemas/bottle-list.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { PageServerLoad } from './$types';

const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;
const FILTERS = {
    all: [AVAILABLE, OUT_OF_CELLAR, CONSUMED],
    in_cave: [AVAILABLE, OUT_OF_CELLAR],
    consumed: [CONSUMED]
};
const filterSchema = z.enum(['all', 'in_cave', 'consumed']).catch('all');

// The columns that the table shows, and sorts on. A bottle in the cellar has no consumption date.
const WITH_CONSUMPTION = [
    'definition',
    'availability',
    'purchaseDate',
    'consumedDate',
    'format',
    'purchasePrice'
] as const;
const COLUMNS = {
    all: WITH_CONSUMPTION,
    in_cave: ['definition', 'availability', 'purchaseDate', 'format', 'purchasePrice'] as const,
    consumed: WITH_CONSUMPTION
};

// Public data only, as GET /api/bottles gives it. `?filter=` picks the bottles, then
// parsePageQuery reads the sort and the page. A sort on a column that the table of the
// filter does not show gives way to the filter's default sort; the page then writes that sort into
// the URL at the next change of filter.
export const load: PageServerLoad = ({ url, depends }) => {
    depends(CELLAR);
    const filter = filterSchema.parse(url.searchParams.get('filter') ?? undefined);
    const columns = COLUMNS[filter];
    const query = parsePageQuery(
        url.searchParams,
        columns,
        filter === 'consumed' ? 'consumedDate' : 'purchaseDate'
    );
    return {
        filter,
        columns,
        ...query,
        ...listBottlePage({ ...query, availabilities: FILTERS[filter] })
    };
};
