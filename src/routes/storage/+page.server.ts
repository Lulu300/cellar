import { getDefinitionDetails } from '#lib/server/features/catalog/service.js';
import { storageOverview, wineLocations } from '#lib/server/features/storage/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only: the containers and cases that GET /api/storage-containers and
// /api/storage-cases give, with the bottles that GET /api/storage-occupancy counts, and the cases
// of the wine of `?wine=`, which GET /api/wines/{id}/locations gives.
export const load: PageServerLoad = ({ depends, url }) => {
    depends(CELLAR);
    return {
        containers: storageOverview(),
        highlight: casesHoldingWine(url.searchParams.get('wine'))
    };
};

/**
 * The wine that "Show in the cellar" looks for, with the cases that hold its bottles, in the
 * order of the page; null for no wine, a wine that does not exist or one in no case.
 */
function casesHoldingWine(id: string | null) {
    if (!id) return null;
    try {
        const { name } = getDefinitionDetails(id);
        const cases = wineLocations(id).locations.map(({ caseId, case: caseName }) => ({
            id: caseId,
            name: caseName
        }));
        return cases.length > 0 ? { id, name, cases } : null;
    } catch (cause) {
        if (cause instanceof NotFoundError) return null;
        throw cause;
    }
}
