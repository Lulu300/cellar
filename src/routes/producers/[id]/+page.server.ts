import { error } from '@sveltejs/kit';
import { imageUrlsById } from '#lib/server/features/images/service.js';
import { getProducerDetails } from '#lib/server/features/producers/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/producers/{id} and /api/images give it.
export const load: PageServerLoad = ({ params, depends }) => {
    depends(CELLAR);
    try {
        return { producer: getProducerDetails(params.id), imageUrls: imageUrlsById() };
    } catch (cause) {
        if (cause instanceof NotFoundError) error(404, cause.message);
        throw cause;
    }
};
