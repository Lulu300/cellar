import { listBottlePage } from '#lib/server/features/bottles/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { parseBottlePageQuery } from '#lib/shared/schemas/bottle-list.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { PageServerLoad } from './$types';

// The columns that the table shows, and sorts on.
const COLUMNS = [
    'definition',
    'location',
    'format',
    'purchaseDate',
    'origin',
    'purchasePrice',
    'barcode'
] as const;

// Public data only, as GET /api/bottles gives it.
export const load: PageServerLoad = ({ url, depends }) => {
    depends(CELLAR);
    const query = parseBottlePageQuery(url.searchParams, COLUMNS, 'purchaseDate');
    return {
        columns: COLUMNS,
        ...query,
        ...listBottlePage({ ...query, availabilities: [BottleAvailability.OUT_OF_CELLAR] })
    };
};
