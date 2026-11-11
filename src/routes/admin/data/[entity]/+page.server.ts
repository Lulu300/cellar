import { error } from '@sveltejs/kit';
import {
    originHandlers,
    wineClassificationHandlers,
    wineColorHandlers,
    wineFormatHandlers,
    wineTypeHandlers
} from '#lib/server/features/catalog/service.js';
import {
    appellationHandlers,
    countryHandlers,
    regionHandlers
} from '#lib/server/features/geography/service.js';
import {
    isReferenceSlug,
    type ReferenceRow,
    type ReferenceSlug
} from '#lib/shared/reference-tables.js';
import { imageUrlsById } from '#lib/server/features/images/service.js';
import { producerHandlers } from '#lib/server/features/producers/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

const HANDLERS: Record<ReferenceSlug, { list: () => unknown[] }> = {
    countries: countryHandlers,
    regions: regionHandlers,
    appellations: appellationHandlers,
    'wine-types': wineTypeHandlers,
    'wine-colors': wineColorHandlers,
    'wine-classifications': wineClassificationHandlers,
    'wine-formats': wineFormatHandlers,
    origins: originHandlers,
    producers: producerHandlers
};

export const load: PageServerLoad = ({ params, locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    const slug = params.entity;
    if (!isReferenceSlug(slug)) error(404, 'Not Found');
    // The countries and regions that the form offers as parents come from the root layout.
    return {
        slug,
        items: HANDLERS[slug].list() as ReferenceRow[],
        // The photos of the producers, which a merge compares
        imageUrls: slug === 'producers' ? imageUrlsById() : new Map<string, string>()
    };
};
