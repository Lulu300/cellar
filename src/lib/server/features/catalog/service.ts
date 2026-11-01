import { db } from '#lib/server/db/index.js';
import {
    origins,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineTypes
} from '#lib/server/db/schema.js';
import type { Tx } from '#lib/server/db/connection.js';
import { listBottlesWithoutDefinitions } from '#lib/server/features/bottles/service.js';
import { followMainPhotoChange } from '#lib/server/features/images/service.js';
import { createLookupCrud } from '#lib/server/features/shared/lookup-crud.js';
import { ConflictError, NotFoundError } from '#lib/server/http/errors.js';
import { namedSchema, wineColorBodySchema } from '#lib/shared/schemas/reference.js';
import { startingHex } from '#lib/shared/wine-colors.js';
import type { WineDefinitionInput } from '#lib/shared/schemas/wine.js';
import {
    countBottlesOf,
    deleteBottlesOf,
    deleteDefinition,
    getDefinition,
    getDefinitionWithLocation,
    insertDefinition,
    listDefinitionsWithLocation,
    updateDefinition,
    type WineWithLocation
} from './repository';

export { listDefinitionsForAdmin } from './repository';

// The reference lists of the wine and bottle forms.

export const wineTypeHandlers = createLookupCrud({
    table: wineTypes,
    nameColumn: 'type',
    schema: namedSchema,
    usage: { column: wineDefinitions.typeId, usedBy: 'wine_definitions' }
});

export const wineColorHandlers = createLookupCrud({
    table: wineColors,
    nameColumn: 'color',
    schema: wineColorBodySchema,
    defaults: ({ name }) => ({ hex: startingHex(name) }),
    usage: { column: wineDefinitions.colorId, usedBy: 'wine_definitions' }
});

export const wineClassificationHandlers = createLookupCrud({
    table: wineClassifications,
    nameColumn: 'name',
    schema: namedSchema,
    usage: { column: wineDefinitions.classificationId, usedBy: 'wine_definitions' }
});

export const wineFormatHandlers = createLookupCrud({
    table: wineFormats,
    nameColumn: 'name',
    schema: namedSchema,
    usage: { column: wineBottles.formatId, usedBy: 'bottles' }
});

export const originHandlers = createLookupCrud({
    table: origins,
    nameColumn: 'name',
    schema: namedSchema,
    usage: { column: wineBottles.originId, usedBy: 'bottles' }
});

/** The flat location fields of a wine, for the lists that show them. */
const flatLocation = ({ appellation }: WineWithLocation) => ({
    region: appellation.region.name,
    appellationName: appellation.name,
    country: appellation.region.country.name
});

export function listDefinitions() {
    return listDefinitionsWithLocation().map((wine) => ({
        ...wine,
        grapeVarieties: wine.grapeVarieties || [],
        ...flatLocation(wine)
    }));
}

const wineNotFound = () => new NotFoundError('Wine definition not found');

export function getDefinitionDetails(id: string) {
    const wine = getDefinitionWithLocation(id);
    if (!wine) throw wineNotFound();
    return {
        ...wine,
        website: wine.website || null,
        description: wine.description || null,
        imageId: wine.imageId || null,
        grapeVarieties: wine.grapeVarieties || []
    };
}

// One statement each, which SQLite runs all or nothing.
export const createDefinition = (data: WineDefinitionInput) => insertDefinition(data);

/** Changes the fields of `data` on the wine. Throws a NotFoundError for an unknown wine. */
function changeDefinition(id: string, data: Partial<WineDefinitionInput>, tx: Tx = db) {
    const wine = updateDefinition(id, data, tx);
    if (!wine) throw wineNotFound();
    return wine;
}

/** Replaces every field of the wine; its photos follow a change of its main one. */
export const replaceDefinition = (id: string, data: WineDefinitionInput) =>
    db.transaction((tx) => {
        const formerMainId = getDefinition(id, tx)?.imageId ?? null;
        changeDefinition(id, data, tx);
        followMainPhotoChange(id, formerMainId, tx);
        return getDefinition(id, tx)!;
    });

/** Gives the wine `rating`, or none with null, and leaves its other fields as they are. */
export const rateDefinition = (id: string, rating: WineDefinitionInput['rating']) =>
    changeDefinition(id, { rating });

/**
 * Deletes the wine, with its bottles when `withBottles` is set. Without it, throws a ConflictError
 * (in_use) with their count while bottles use it, for the admin page to offer to delete them too.
 * Throws a NotFoundError for an unknown wine.
 */
export function deleteDefinitionAndBottles(id: string, withBottles: boolean): void {
    // In one transaction: the bottles counted are those deleted, and a failure deletes none.
    db.transaction((tx) => {
        const bottleCount = countBottlesOf(id, tx);
        if (bottleCount > 0 && !withBottles) {
            throw new ConflictError(
                'in_use',
                `This wine has ${bottleCount} bottle${bottleCount > 1 ? 's' : ''} in the cellar`,
                { bottleCount }
            );
        }
        if (withBottles) deleteBottlesOf(id, tx);
        if (!deleteDefinition(id, tx)) throw wineNotFound();
    });
}

/**
 * Every wine, in `definition`, with its bottles in `bottles`, which do not repeat the wine: every
 * bottle for the API, only those still owned with `ownedOnly`, which the wine list shows.
 */
export function listWines({ ownedOnly = false } = {}) {
    const bottlesByWine = Map.groupBy(
        listBottlesWithoutDefinitions({ ownedOnly }),
        (bottle) => bottle.definitionId
    );

    return listDefinitionsWithLocation().map((wine) => ({
        definition: {
            ...wine,
            ...flatLocation(wine),
            classification: wine.classification || undefined,
            website: wine.website || undefined,
            description: wine.description || undefined
        },
        bottles: bottlesByWine.get(wine.id) ?? []
    }));
}
