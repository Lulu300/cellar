import { eq, sql } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import {
    appellations,
    countries,
    producers,
    regions,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineTypes,
    type Producer
} from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';

/** The bottles of the producer of the row, in `availability`. */
const bottlesOfProducer = (availability: BottleAvailability) =>
    sql<number>`(SELECT count(*) FROM ${wineBottles}
        INNER JOIN ${wineDefinitions} ON ${wineBottles.definitionId} = ${wineDefinitions.id}
        WHERE ${wineDefinitions.producerId} = ${producers.id}
            AND ${wineBottles.availability} = ${availability})`;

/**
 * The producers with the names of their country and region, and what they count: their wines,
 * their bottles in the cellar and those drunk.
 */
export const producerRows = (tx: Tx) =>
    tx
        .select({
            id: producers.id,
            name: producers.name,
            countryId: producers.countryId,
            countryName: countries.name,
            regionId: producers.regionId,
            regionName: regions.name,
            website: producers.website,
            contact: producers.contact,
            description: producers.description,
            imageId: producers.imageId,
            wineCount: sql<number>`(SELECT count(*) FROM ${wineDefinitions}
                WHERE ${wineDefinitions.producerId} = ${producers.id})`,
            bottleCount: bottlesOfProducer(BottleAvailability.AVAILABLE),
            consumedCount: bottlesOfProducer(BottleAvailability.CONSUMED),
            createdAt: producers.createdAt,
            updatedAt: producers.updatedAt
        })
        .from(producers)
        .leftJoin(countries, eq(producers.countryId, countries.id))
        .leftJoin(regions, eq(producers.regionId, regions.id))
        .$dynamic();

export type ProducerRow = ReturnType<ReturnType<typeof producerRows>['all']>[number];

export function getProducer(id: string, tx: Tx): Producer | undefined {
    return tx.select().from(producers).where(eq(producers.id, id)).get();
}

/** Moves the wines of producer `fromId` to producer `toId`. */
export function moveWines(fromId: string, toId: string, tx: Tx): void {
    tx.update(wineDefinitions)
        .set({ producerId: toId, updatedAt: new Date() })
        .where(eq(wineDefinitions.producerId, fromId))
        .run();
}

export function changeProducer(id: string, values: Partial<Producer>, tx: Tx): void {
    tx.update(producers)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(producers.id, id))
        .run();
}

export function deleteProducer(id: string, tx: Tx): void {
    tx.delete(producers).where(eq(producers.id, id)).run();
}

/** The bottles of the wine of the row, in `availability`. */
const bottlesOfWine = (availability: BottleAvailability) =>
    sql<number>`(SELECT count(*) FROM ${wineBottles}
        WHERE ${wineBottles.definitionId} = ${wineDefinitions.id}
            AND ${wineBottles.availability} = ${availability})`;

/** The wines of a producer, by name, with where they come from and their bottles counted. */
export function winesOfProducer(producerId: string, tx: Tx) {
    return tx
        .select({
            id: wineDefinitions.id,
            name: wineDefinitions.name,
            imageId: wineDefinitions.imageId,
            type: wineTypes.type,
            color: wineColors.color,
            colorHex: wineColors.hex,
            classification: wineClassifications.name,
            appellationName: appellations.name,
            regionName: regions.name,
            countryName: countries.name,
            bottleCount: bottlesOfWine(BottleAvailability.AVAILABLE),
            consumedCount: bottlesOfWine(BottleAvailability.CONSUMED)
        })
        .from(wineDefinitions)
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(wineClassifications, eq(wineDefinitions.classificationId, wineClassifications.id))
        .where(eq(wineDefinitions.producerId, producerId))
        .orderBy(wineDefinitions.name)
        .all();
}
