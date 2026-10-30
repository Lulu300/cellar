import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    wineBottles,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineTypes,
    type NewWineBottle
} from '#lib/server/db/schema.js';
import { bottleSchema, type BottleInput } from '#lib/shared/schemas/bottle.js';

/**
 * Inserts a wine and the rows it needs, with the format `bottle`, so that bottles can be created;
 * returns its id.
 */
export async function insertWineDefinition(): Promise<string> {
    const now = new Date();
    const timestamps = { createdAt: now, updatedAt: now };
    await db.insert(countries).values({ id: 'fr', name: 'France', ...timestamps });
    await db
        .insert(regions)
        .values({ id: 'bdx', name: 'Bordeaux', countryId: 'fr', ...timestamps });
    await db
        .insert(appellations)
        .values({ id: 'mgx', name: 'Margaux', regionId: 'bdx', ...timestamps });
    await db.insert(wineTypes).values({ id: 'still', type: 'Still', ...timestamps });
    await db.insert(wineColors).values({ id: 'red', color: 'Red', ...timestamps });
    await db.insert(wineFormats).values({ id: 'bottle', name: 'Bottle', ...timestamps });
    await db.insert(wineDefinitions).values({
        id: 'margaux',
        name: 'Château Margaux',
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        ...timestamps
    });
    return 'margaux';
}

/** A bottle of `definitionId` in the format `bottle`, as the API reads it, with `fields` set. */
export function bottleData(
    definitionId: string,
    fields: Record<string, unknown> = {}
): BottleInput {
    return bottleSchema.parse({ definitionId, formatId: 'bottle', ...fields });
}

/**
 * Inserts bottles of `definitionId` in the format `bottle` straight into the table, without the
 * rules of the service (capacities, barcodes), each row with its own fields; a row without an id
 * gets a new one.
 */
export async function insertBottles(
    definitionId: string,
    rows: Partial<NewWineBottle>[]
): Promise<void> {
    const now = new Date();
    await db.insert(wineBottles).values(
        rows.map((row) => ({
            id: randomUUID(),
            definitionId,
            formatId: 'bottle',
            createdAt: now,
            updatedAt: now,
            ...row
        }))
    );
}
