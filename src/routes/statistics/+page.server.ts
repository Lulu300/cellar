import { getStatistics } from '#lib/server/features/bottles/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/statistics gives it.
export const load: PageServerLoad = async ({ depends }) => {
    depends(CELLAR);
    return { statsData: await getStatistics() };
};
