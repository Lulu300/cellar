import { and, asc, count, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { namingMissingReferences } from '#lib/server/db-errors.js';
import {
    appellations,
    countries,
    origins,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineTypes,
    type NewWineBottle,
    type WineBottle
} from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';

/** The fields of a bottle that a client sets. */
export type BottleFields = Omit<NewWineBottle, 'id' | 'createdAt' | 'updatedAt'>;

export function insertBottle(fields: BottleFields, tx: Tx): WineBottle {
    return namingMissingReferences(wineBottles, fields, tx, () =>
        tx.insert(wineBottles).values(fields).returning().get()
    );
}

/** The bottles of `ids` that exist, in no particular order. */
export function findBottles(ids: string[], tx: Tx): WineBottle[] {
    return tx.select().from(wineBottles).where(inArray(wineBottles.id, ids)).all();
}

/** Sets the fields given, and only those; undefined when there is no such bottle. */
export function updateBottle(
    id: string,
    fields: Partial<BottleFields>,
    tx: Tx
): WineBottle | undefined {
    return namingMissingReferences(wineBottles, fields, tx, () =>
        tx
            .update(wineBottles)
            .set({ ...fields, updatedAt: new Date() })
            .where(eq(wineBottles.id, id))
            .returning()
            .get()
    );
}

/** Returns whether there was such a bottle. */
export function deleteBottle(id: string): boolean {
    return db.delete(wineBottles).where(eq(wineBottles.id, id)).run().changes > 0;
}

export function deleteBottles(ids: string[], tx: Tx): void {
    tx.delete(wineBottles).where(inArray(wineBottles.id, ids)).run();
}

/** The name of a format that a bottle just written uses: its foreign key makes it exist. */
export function formatName(formatId: string, tx: Tx): string {
    const format = tx
        .select({ name: wineFormats.name })
        .from(wineFormats)
        .where(eq(wineFormats.id, formatId))
        .get();
    return format!.name;
}

/** The bottles with their format, case and origin, to be narrowed with where(). */
function bottlesWithDetails() {
    return db
        .select()
        .from(wineBottles)
        .leftJoin(origins, eq(wineBottles.originId, origins.id))
        .innerJoin(wineFormats, eq(wineBottles.formatId, wineFormats.id))
        .leftJoin(storageCases, eq(wineBottles.storageCaseId, storageCases.id))
        .leftJoin(storageContainers, eq(storageCases.containerId, storageContainers.id))
        .$dynamic();
}

/** The same, with their wine and the names of its type, color and classification. */
function bottlesWithDefinitions() {
    return bottlesWithDetails()
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(
            wineClassifications,
            eq(wineDefinitions.classificationId, wineClassifications.id)
        );
}

type BottleRow = ReturnType<ReturnType<typeof bottlesWithDetails>['all']>[number];
type BottleWithDefinitionRow = ReturnType<ReturnType<typeof bottlesWithDefinitions>['all']>[number];

/** The bottle with its format, case and origin. */
function toBottle(row: BottleRow) {
    return {
        ...row.wine_bottles,
        format: row.wine_formats.name,
        storageCase: row.storage_cases
            ? { ...row.storage_cases, container: row.storage_containers || null }
            : null,
        origin: row.origins
    };
}

function toBottleWithDefinition(row: BottleWithDefinitionRow) {
    return {
        ...toBottle(row),
        definition: {
            ...row.wine_definitions,
            type: row.wine_types.type,
            color: row.wine_colors.color,
            colorHex: row.wine_colors.hex,
            classification: row.wine_classifications?.name ?? null
        }
    };
}

/**
 * Every bottle with its format, case and origin but not its wine, for a list that puts each
 * bottle under its wine; only those still owned (not consumed) with `ownedOnly`.
 */
export function listBottlesWithoutDefinitions({ ownedOnly = false } = {}) {
    return bottlesWithDetails()
        .where(ownedOnly ? ne(wineBottles.availability, BottleAvailability.CONSUMED) : undefined)
        .all()
        .map(toBottle);
}

/** Every bottle with its wine, format, case and origin; only those of one wine when given. */
export function listBottlesWithDefinitions(definitionId?: string) {
    return bottlesWithDefinitions()
        .where(definitionId === undefined ? undefined : eq(wineBottles.definitionId, definitionId))
        .all()
        .map(toBottleWithDefinition);
}

/**
 * The bottles that a case holds, with their wine, format, case and origin: the available ones, as
 * caseLoads counts them; a bottle out of the cellar keeps its case without being in it.
 */
export function listBottlesInCase(caseId: string) {
    return bottlesWithDefinitions()
        .where(
            and(
                eq(wineBottles.storageCaseId, caseId),
                eq(wineBottles.availability, BottleAvailability.AVAILABLE)
            )
        )
        .all()
        .map(toBottleWithDefinition);
}

/** The bottles of these availabilities, with their wine, format, case and origin, by id. */
export function listBottlesByAvailability(availabilities: BottleAvailability[]) {
    return bottlesWithDefinitions()
        .where(inArray(wineBottles.availability, availabilities))
        .orderBy(asc(wineBottles.id))
        .all()
        .map(toBottleWithDefinition);
}

/**
 * The case and the dates of each bottle in the cellar that a case holds and that has a « drink
 * before » or an optimum year: what the storage page marks.
 */
export function listCaseDrinkingDates() {
    return db
        .select({
            // Never null: the where leaves those out.
            storageCaseId: sql<string>`${wineBottles.storageCaseId}`,
            drinkBefore: wineBottles.drinkBefore,
            optimum: wineBottles.optimum
        })
        .from(wineBottles)
        .where(
            and(
                eq(wineBottles.availability, BottleAvailability.AVAILABLE),
                isNotNull(wineBottles.storageCaseId),
                or(isNotNull(wineBottles.drinkBefore), isNotNull(wineBottles.optimum))
            )
        )
        .all();
}

/** How many bottles have this availability. */
export function countBottlesByAvailability(availability: BottleAvailability): number {
    return db
        .select({ count: count() })
        .from(wineBottles)
        .where(eq(wineBottles.availability, availability))
        .get()!.count;
}

/** The bottles available or out of the cellar, with what the bottle lists show of them. */
export function listBottlesNotConsumed() {
    const rows = db
        .select()
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(storageCases, eq(wineBottles.storageCaseId, storageCases.id))
        .innerJoin(wineFormats, eq(wineBottles.formatId, wineFormats.id))
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .leftJoin(origins, eq(wineBottles.originId, origins.id))
        .where(
            or(
                eq(wineBottles.availability, BottleAvailability.AVAILABLE),
                eq(wineBottles.availability, BottleAvailability.OUT_OF_CELLAR)
            )
        )
        .all();

    return rows.map(
        ({
            wine_bottles: bottle,
            wine_formats,
            origins,
            wine_definitions,
            wine_colors,
            appellations,
            storage_cases
        }) => ({
            id: bottle.id,
            vintage: bottle.vintage,
            optimum: bottle.optimum,
            drinkBefore: bottle.drinkBefore,
            formatId: bottle.formatId,
            format: wine_formats.name,
            purchasePrice: bottle.purchasePrice,
            purchaseDate: bottle.purchaseDate,
            currentValue: bottle.currentValue,
            currentValueDate: bottle.currentValueDate,
            originId: bottle.originId,
            origin: origins ? { id: origins.id, name: origins.name } : null,
            barcode: bottle.barcode,
            notes: bottle.notes,
            availability: bottle.availability,
            // Named as the other bottle lists name the wine, which BottleTable reads.
            definition: {
                id: wine_definitions.id,
                name: wine_definitions.name,
                producer: wine_definitions.producer,
                appellation: appellations.name,
                color: wine_colors.color,
                colorHex: wine_colors.hex
            },
            storageCase: storage_cases ? { id: storage_cases.id, name: storage_cases.name } : null
        })
    );
}

/** Every bottle with the names of its wine, place and references, for the admin page. */
export function listBottlesForAdmin() {
    return db
        .select({
            id: wineBottles.id,
            definitionId: wineBottles.definitionId,
            wineName: wineDefinitions.name,
            producer: wineDefinitions.producer,
            appellationName: appellations.name,
            regionName: regions.name,
            countryName: countries.name,
            typeName: wineTypes.type,
            colorName: wineColors.color,
            vintage: wineBottles.vintage,
            optimum: wineBottles.optimum,
            drinkBefore: wineBottles.drinkBefore,
            originId: wineBottles.originId,
            originName: origins.name,
            formatId: wineBottles.formatId,
            formatName: wineFormats.name,
            barcode: wineBottles.barcode,
            purchasePrice: wineBottles.purchasePrice,
            purchaseDate: wineBottles.purchaseDate,
            currentValue: wineBottles.currentValue,
            currentValueDate: wineBottles.currentValueDate,
            storageCaseId: wineBottles.storageCaseId,
            storageCaseName: storageCases.name,
            notes: wineBottles.notes,
            availability: wineBottles.availability,
            consumedDate: wineBottles.consumedDate,
            createdAt: wineBottles.createdAt,
            updatedAt: wineBottles.updatedAt
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .innerJoin(wineFormats, eq(wineBottles.formatId, wineFormats.id))
        .leftJoin(origins, eq(wineBottles.originId, origins.id))
        .leftJoin(storageCases, eq(wineBottles.storageCaseId, storageCases.id))
        .orderBy(desc(wineBottles.createdAt))
        .all();
}

/** The figures of the statistics page, each over the available bottles unless it says otherwise. */
export async function cellarStatistics() {
    // Total cellar value (purchase price and current value)
    const valueStats = await db
        .select({
            totalPurchaseValue: sql<number>`COALESCE(SUM(CASE WHEN ${wineBottles.availability} = 'available' AND ${wineBottles.purchasePrice} IS NOT NULL THEN ${wineBottles.purchasePrice} END), 0)`,
            totalCurrentValue: sql<number>`COALESCE(SUM(CASE WHEN ${wineBottles.availability} = 'available' AND ${wineBottles.currentValue} IS NOT NULL THEN ${wineBottles.currentValue} END), 0)`,
            totalHybridValue: sql<number>`COALESCE(SUM(CASE WHEN ${wineBottles.availability} = 'available' THEN COALESCE(${wineBottles.currentValue}, ${wineBottles.purchasePrice}, 0) END), 0)`,
            avgPurchasePrice: sql<
                number | null
            >`AVG(CASE WHEN ${wineBottles.availability} = 'available' AND ${wineBottles.purchasePrice} IS NOT NULL THEN ${wineBottles.purchasePrice} END)`,
            avgCurrentValue: sql<
                number | null
            >`AVG(CASE WHEN ${wineBottles.availability} = 'available' AND ${wineBottles.currentValue} IS NOT NULL THEN ${wineBottles.currentValue} END)`
        })
        .from(wineBottles);

    // Total bottles by availability
    const bottlesByAvailability = await db
        .select({
            availability: wineBottles.availability,
            count: count()
        })
        .from(wineBottles)
        .groupBy(wineBottles.availability);

    // The joins below are inner: every bottle has a wine, and every wine an appellation (in a
    // region of a country), a type and a color.

    // Wine distribution by type
    const winesByType = await db
        .select({
            type: wineTypes.type,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .where(eq(wineBottles.availability, 'available'))
        .groupBy(wineTypes.type);

    // Wine distribution by color
    const winesByColor = await db
        .select({
            color: wineColors.color,
            hex: wineColors.hex,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .where(eq(wineBottles.availability, 'available'))
        .groupBy(wineColors.id)
        .orderBy(wineColors.color);

    // Wine distribution by country (top 10)
    const winesByCountry = await db
        .select({
            country: countries.name,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .where(eq(wineBottles.availability, 'available'))
        .groupBy(countries.id)
        .orderBy(sql`COUNT(DISTINCT ${wineBottles.id}) DESC`)
        .limit(10);

    // Wine distribution by region (top 10). Two countries may each have a region of the same
    // name, such as Central Valley: they stay apart, each with its country.
    const winesByRegion = await db
        .select({
            id: regions.id,
            region: regions.name,
            country: countries.name,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .where(eq(wineBottles.availability, 'available'))
        .groupBy(regions.id)
        .orderBy(sql`COUNT(DISTINCT ${wineBottles.id}) DESC`)
        .limit(10);

    // Vintage distribution; never null, which the where leaves out
    const winesByVintage = await db
        .select({
            vintage: sql<number>`${wineBottles.vintage}`,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .where(and(eq(wineBottles.availability, 'available'), isNotNull(wineBottles.vintage)))
        .groupBy(wineBottles.vintage)
        .orderBy(wineBottles.vintage);

    // Age distribution (bottles by decade)
    const winesByDecade = await db
        .select({
            decade: sql<number>`(${wineBottles.vintage} / 10) * 10`,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .where(and(eq(wineBottles.availability, 'available'), isNotNull(wineBottles.vintage)))
        .groupBy(sql`(${wineBottles.vintage} / 10) * 10`)
        .orderBy(sql`(${wineBottles.vintage} / 10) * 10`);

    // Top producers by bottle count. The wines without a producer are left out before the top 10
    // is taken, so that they do not hold one of its places; never null then.
    const topProducers = await db
        .select({
            producer: sql<string>`${wineDefinitions.producer}`,
            count: sql<number>`COUNT(DISTINCT ${wineBottles.id})`
        })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .where(and(eq(wineBottles.availability, 'available'), isNotNull(wineDefinitions.producer)))
        .groupBy(wineDefinitions.producer)
        .orderBy(sql`COUNT(DISTINCT ${wineBottles.id}) DESC`)
        .limit(10);

    // Total counts
    const totalStats = await db
        .select({
            totalDefinitions: sql<number>`COUNT(DISTINCT ${wineDefinitions.id})`,
            totalBottles: sql<number>`COUNT(CASE WHEN ${wineBottles.availability} = 'available' THEN 1 END)`,
            totalConsumed: sql<number>`COUNT(CASE WHEN ${wineBottles.availability} = 'consumed' THEN 1 END)`,
            totalOutOfCellar: sql<number>`COUNT(CASE WHEN ${wineBottles.availability} = 'out_of_cellar' THEN 1 END)`
        })
        .from(wineDefinitions)
        .leftJoin(wineBottles, eq(wineDefinitions.id, wineBottles.definitionId));

    return {
        valueStats,
        bottlesByAvailability,
        winesByType,
        winesByColor,
        winesByCountry,
        winesByRegion,
        winesByVintage,
        winesByDecade,
        topProducers,
        totalStats
    };
}

/**
 * The wines with fewer available bottles than their target quantity, with their bottle counts and
 * prices. A wine without a target is left out, and one with a target of 0 is never short.
 */
export async function winesBelowTarget() {
    const shortageData = await db
        .select({
            // Wine definition fields
            id: wineDefinitions.id,
            name: wineDefinitions.name,
            producer: wineDefinitions.producer,
            // Never null: the where leaves those out
            targetQuantity: sql<number>`${wineDefinitions.targetQuantity}`,
            imageId: wineDefinitions.imageId,

            // Location data
            appellation: appellations.name,
            region: regions.name,
            country: countries.name,

            // Wine type and color
            type: wineTypes.type,
            color: wineColors.color,
            classification: wineClassifications.name,

            // Current bottle count (available bottles only)
            currentCount: sql<number>`COALESCE(COUNT(CASE WHEN ${wineBottles.availability} = 'available' THEN 1 END), 0)`,

            // Total bottle count (all bottles including consumed/out of cellar)
            totalCount: sql<number>`COALESCE(COUNT(${wineBottles.id}), 0)`,

            // Price statistics (available and out_of_cellar bottles with purchase prices)
            minPrice: sql<
                number | null
            >`MIN(CASE WHEN (${wineBottles.availability} = 'available' OR ${wineBottles.availability} = 'out_of_cellar') AND ${wineBottles.purchasePrice} IS NOT NULL THEN ${wineBottles.purchasePrice} END)`,
            maxPrice: sql<
                number | null
            >`MAX(CASE WHEN (${wineBottles.availability} = 'available' OR ${wineBottles.availability} = 'out_of_cellar') AND ${wineBottles.purchasePrice} IS NOT NULL THEN ${wineBottles.purchasePrice} END)`,
            avgPrice: sql<
                number | null
            >`AVG(CASE WHEN (${wineBottles.availability} = 'available' OR ${wineBottles.availability} = 'out_of_cellar') AND ${wineBottles.purchasePrice} IS NOT NULL THEN ${wineBottles.purchasePrice} END)`
        })
        .from(wineDefinitions)
        .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
        .innerJoin(regions, eq(appellations.regionId, regions.id))
        .innerJoin(countries, eq(regions.countryId, countries.id))
        .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .leftJoin(wineClassifications, eq(wineDefinitions.classificationId, wineClassifications.id))
        .leftJoin(wineBottles, eq(wineDefinitions.id, wineBottles.definitionId))
        .where(isNotNull(wineDefinitions.targetQuantity))
        .groupBy(
            wineDefinitions.id,
            wineDefinitions.name,
            wineDefinitions.producer,
            wineDefinitions.targetQuantity,
            wineDefinitions.imageId,
            appellations.name,
            regions.name,
            countries.name,
            wineTypes.type,
            wineColors.color,
            wineClassifications.name
        )
        .having(
            sql`COALESCE(COUNT(CASE WHEN ${wineBottles.availability} = 'available' THEN 1 END), 0) < ${wineDefinitions.targetQuantity}`
        );

    return shortageData;
}
