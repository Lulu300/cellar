import { listDefinitions } from '#lib/server/features/catalog/service.js';
import { listWishes } from '#lib/server/features/wishlist/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { compareText } from '#lib/utils/compare.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/wishes and /api/definitions give it.
export const load: PageServerLoad = ({ depends, locals }) => {
    depends(CELLAR);
    return {
        wishes: listWishes(),
        // The wines that the field suggests, by their name: the field needs a session
        wines: locals.session
            ? listDefinitions()
                  .map(({ id, name, producer }) => ({ id, name, producer }))
                  .sort((a, b) => compareText(a.name, b.name))
            : []
    };
};
