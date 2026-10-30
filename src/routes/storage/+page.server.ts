import { storageOverview } from '#lib/server/features/storage/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only: the containers and cases that GET /api/storage-containers and
// /api/storage-cases give, with the bottles that GET /api/storage-occupancy counts.
export const load: PageServerLoad = ({ depends }) => {
    depends(CELLAR);
    return { containers: storageOverview() };
};
