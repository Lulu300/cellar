import { eq } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { appellations, countries, regions } from '#lib/server/db/schema.js';

/** Regions with the name of their country. */
export const regionsWithCountry = (tx: Tx) =>
    tx
        .select({
            id: regions.id,
            name: regions.name,
            countryId: regions.countryId,
            countryName: countries.name,
            createdAt: regions.createdAt,
            updatedAt: regions.updatedAt
        })
        .from(regions)
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .$dynamic();

/** Appellations with the names of their region and country. */
export const appellationsWithRegion = (tx: Tx) =>
    tx
        .select({
            id: appellations.id,
            name: appellations.name,
            regionId: appellations.regionId,
            regionName: regions.name,
            countryId: regions.countryId,
            countryName: countries.name,
            createdAt: appellations.createdAt,
            updatedAt: appellations.updatedAt
        })
        .from(appellations)
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .$dynamic();
