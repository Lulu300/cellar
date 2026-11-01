import { count, eq } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineTypes,
    type WineDefinition
} from '#lib/server/db/schema.js';
import type { WineDefinitionInput } from '#lib/shared/schemas/wine.js';

/** A wine with its location and the names of its type, color and classification. */
const definitionsWithLocation = () =>
    db
        .select({
            wine_definitions: wineDefinitions,
            appellations: appellations,
            regions: regions,
            countries: countries,
            wine_types: wineTypes,
            wine_colors: wineColors,
            wine_classifications: wineClassifications
        })
        .from(wineDefinitions)
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(
            wineClassifications,
            eq(wineDefinitions.classificationId, wineClassifications.id)
        );

type DefinitionRow = ReturnType<ReturnType<typeof definitionsWithLocation>['all']>[number];

/** The wine with the names of its type, color and classification, and its nested location. */
function withLocation(row: DefinitionRow) {
    return {
        ...row.wine_definitions,
        type: row.wine_types.type,
        color: row.wine_colors.color,
        colorHex: row.wine_colors.hex,
        classification: row.wine_classifications?.name ?? null,
        appellation: { ...row.appellations, region: { ...row.regions, country: row.countries } }
    };
}

export type WineWithLocation = ReturnType<typeof withLocation>;

export function listDefinitionsWithLocation(): WineWithLocation[] {
    return definitionsWithLocation().all().map(withLocation);
}

/** The wine with its nested location. */
export function getDefinitionWithLocation(id: string): WineWithLocation | undefined {
    const row = definitionsWithLocation().where(eq(wineDefinitions.id, id)).get();
    return row && withLocation(row);
}

export function insertDefinition(data: WineDefinitionInput): WineDefinition {
    return db.insert(wineDefinitions).values(data).returning().get();
}

/** Changes the fields of `data` on the wine; undefined when there is no such wine. */
export function updateDefinition(id: string, data: Partial<WineDefinitionInput>, tx: Tx = db) {
    return tx
        .update(wineDefinitions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(wineDefinitions.id, id))
        .returning()
        .get();
}

export function getDefinition(id: string, tx: Tx = db): WineDefinition | undefined {
    return tx.select().from(wineDefinitions).where(eq(wineDefinitions.id, id)).get();
}

/** Returns whether there was such a wine. */
export function deleteDefinition(id: string, tx: Tx = db): boolean {
    return tx.delete(wineDefinitions).where(eq(wineDefinitions.id, id)).run().changes > 0;
}

export function countBottlesOf(definitionId: string, tx: Tx): number {
    return (
        tx
            .select({ count: count() })
            .from(wineBottles)
            .where(eq(wineBottles.definitionId, definitionId))
            .get()?.count ?? 0
    );
}

export function deleteBottlesOf(definitionId: string, tx: Tx): void {
    tx.delete(wineBottles).where(eq(wineBottles.definitionId, definitionId)).run();
}

/** Every wine with the names of its references, for the admin page. */
export function listDefinitionsForAdmin() {
    return db
        .select({
            id: wineDefinitions.id,
            name: wineDefinitions.name,
            producer: wineDefinitions.producer,
            appellationId: wineDefinitions.appellationId,
            appellationName: appellations.name,
            regionId: appellations.regionId,
            regionName: regions.name,
            countryId: regions.countryId,
            countryName: countries.name,
            classificationId: wineDefinitions.classificationId,
            classificationName: wineClassifications.name,
            typeId: wineDefinitions.typeId,
            typeName: wineTypes.type,
            colorId: wineDefinitions.colorId,
            colorName: wineColors.color,
            rating: wineDefinitions.rating,
            website: wineDefinitions.website,
            description: wineDefinitions.description,
            imageId: wineDefinitions.imageId,
            grapeVarieties: wineDefinitions.grapeVarieties,
            targetQuantity: wineDefinitions.targetQuantity,
            createdAt: wineDefinitions.createdAt,
            updatedAt: wineDefinitions.updatedAt
        })
        .from(wineDefinitions)
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(wineClassifications, eq(wineDefinitions.classificationId, wineClassifications.id))
        .orderBy(wineDefinitions.producer, wineDefinitions.name)
        .all();
}
