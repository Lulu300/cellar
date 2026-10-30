import { getWineShortages } from '#lib/server/features/bottles/service.js';
import { imageUrlsById } from '#lib/server/features/images/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/wine-shortage and /api/images give it.
export const load: PageServerLoad = async ({ depends }) => {
    depends(CELLAR);
    return { shortageData: await getWineShortages(), imageUrls: imageUrlsById() };
};
