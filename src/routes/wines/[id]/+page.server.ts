import { error } from '@sveltejs/kit';
import { listBottlesWithDefinitions } from '#lib/server/features/bottles/service.js';
import { getDefinitionDetails } from '#lib/server/features/catalog/service.js';
import { listWinePhotos } from '#lib/server/features/images/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/definitions/{id}, /api/bottles and its photos give it.
export const load: PageServerLoad = ({ params, depends }) => {
    depends(CELLAR);
    const wineDefinition = wineOr404(params.id);
    return {
        wineDefinition,
        bottles: listBottlesWithDefinitions(params.id),
        photos: listWinePhotos(params.id)
    };
};

function wineOr404(id: string) {
    try {
        return getDefinitionDetails(id);
    } catch (cause) {
        if (cause instanceof NotFoundError) error(404, cause.message);
        throw cause;
    }
}
