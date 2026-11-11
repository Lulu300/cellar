import { z } from 'zod';
import { imageUrlsById } from '#lib/server/features/images/service.js';
import {
    findOrCreateProducer,
    listProducers,
    updateProducer
} from '#lib/server/features/producers/service.js';
import { MAX_JSON_BYTES, parseFormData, parseWith } from '#lib/server/http/body.js';
import { ConflictError } from '#lib/server/http/errors.js';
import { formAction } from '#lib/server/http/handler.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { id } from '#lib/shared/schemas/common.js';
import { producerFromForm, producerSchema } from '#lib/shared/schemas/producer.js';
import type { Actions, PageServerLoad } from './$types';

// Public data only, as GET /api/producers and /api/images give it.
export const load: PageServerLoad = ({ depends }) => {
    depends(CELLAR);
    return { producers: listProducers(), imageUrls: imageUrlsById() };
};

/**
 * The producer form posts here, from the list and from a producer's page:
 * `/producers?/createProducer` and `?/updateProducer`.
 */
export const actions = {
    // A name that a producer has already, as the API compares names, is refused rather than
    // answered with that producer, as POST /api/producers does: the form means a new one.
    createProducer: formAction(async ({ request }) => {
        const form = await parseFormData(request, MAX_JSON_BYTES);
        const { producer, created } = findOrCreateProducer(
            parseWith(producerSchema, producerFromForm(form))
        );
        if (!created) {
            throw new ConflictError('duplicate_name', 'A producer has this name already');
        }
        return { producer };
    }),

    updateProducer: formAction(async ({ request }) => {
        const form = await parseFormData(request, MAX_JSON_BYTES);
        const producerId = parseWith(z.object({ id }), { id: form.get('id') }).id;
        return {
            producer: updateProducer(producerId, parseWith(producerSchema, producerFromForm(form)))
        };
    })
} satisfies Actions;
