import { z } from 'zod';
import { createBottles, updateWineBottle } from '#lib/server/features/bottles/service.js';
import {
    createDefinition,
    listWines,
    replaceDefinition
} from '#lib/server/features/catalog/service.js';
import { imageUrlsById } from '#lib/server/features/images/service.js';
import { MAX_JSON_BYTES, parseFormData, parseWith } from '#lib/server/http/body.js';
import { formAction } from '#lib/server/http/handler.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { id } from '#lib/shared/schemas/common.js';
import {
    bottleChangesSchema,
    bottleFromForm,
    newBottlesSchema
} from '#lib/shared/schemas/bottle.js';
import { wineDefinitionSchema, wineFromForm } from '#lib/shared/schemas/wine.js';
import type { Actions, PageServerLoad } from './$types';

// Public data only, as GET /api/wines and /api/images give it. The list shows only the bottles
// still owned: leaving the consumed ones out keeps the page light as the history grows.
export const load: PageServerLoad = ({ depends }) => {
    depends(CELLAR);
    return { wines: listWines({ ownedOnly: true }), imageUrls: imageUrlsById() };
};

/** The form of a request; its text fields stay far below the limit of a JSON body. */
const readForm = (request: Request) => parseFormData(request, MAX_JSON_BYTES);

/** The id of the wine or bottle that an edit form changes. */
const idOf = (form: FormData) => parseWith(z.object({ id }), { id: form.get('id') }).id;

/**
 * The wine and bottle forms, which open from several pages, post here: `/wines?/createWine` and
 * so on. They check their fields with the same readers and schemas before sending, and the
 * failures carry the error body of the API.
 */
export const actions = {
    createWine: formAction(async ({ request }) => {
        const form = await readForm(request);
        return {
            definition: createDefinition(parseWith(wineDefinitionSchema, wineFromForm(form)))
        };
    }),

    updateWine: formAction(async ({ request }) => {
        const form = await readForm(request);
        const wine = parseWith(wineDefinitionSchema, wineFromForm(form));
        return { definition: replaceDefinition(idOf(form), wine) };
    }),

    // 409 (CaseFullError) when the case has no room for them
    createBottles: formAction(async ({ request }) => {
        const form = await readForm(request);
        const { quantity, ...bottle } = parseWith(newBottlesSchema, bottleFromForm(form));
        return { bottles: createBottles(bottle, quantity) };
    }),

    // The form sends only the fields changed.
    updateBottle: formAction(async ({ request }) => {
        const form = await readForm(request);
        const changes = parseWith(bottleChangesSchema, bottleFromForm(form));
        return { bottles: [updateWineBottle(idOf(form), changes)] };
    })
} satisfies Actions;
