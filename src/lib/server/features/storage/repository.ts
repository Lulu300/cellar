import { and, asc, count, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import {
    storageCases,
    storageContainers,
    wineBottles,
    wineColors,
    wineDefinitions,
    type StorageCase,
    type StorageContainer
} from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';

const isAvailable = eq(wineBottles.availability, BottleAvailability.AVAILABLE);

export function allContainers(): StorageContainer[] {
    return db.select().from(storageContainers).all();
}

export function findContainer(id: string, tx: Tx): StorageContainer | undefined {
    return tx.select().from(storageContainers).where(eq(storageContainers.id, id)).get();
}

export function containerNamed(name: string, tx: Tx): StorageContainer | undefined {
    return tx.select().from(storageContainers).where(eq(storageContainers.name, name)).get();
}

/**
 * The order of the cases in a container: by position. Cases that share one, such as those of an
 * export or a CSV file from 0.7.0 or earlier, which have none, keep the order of those versions, as
 * migration 0007 gave it: by the number that ends their name, then by name.
 */
const caseOrder = [
    asc(storageCases.position),
    sql`CAST(substr(${storageCases.name}, length(rtrim(${storageCases.name}, '0123456789')) + 1) AS INTEGER)`,
    asc(storageCases.name)
];

/** Every case, by caseOrder: the order of each container's cases, once grouped by container. */
export function listCases(): StorageCase[] {
    return db
        .select()
        .from(storageCases)
        .orderBy(...caseOrder)
        .all();
}

export function insertContainer(name: string, tx: Tx): StorageContainer {
    return tx.insert(storageContainers).values({ name }).returning().get();
}

export type CaseFields = Pick<StorageCase, 'name' | 'capacity' | 'position'>;

export function insertCase(containerId: string, fields: CaseFields, tx: Tx): StorageCase {
    return tx
        .insert(storageCases)
        .values({ ...fields, containerId })
        .returning()
        .get();
}

export function updateContainerName(id: string, name: string, tx: Tx) {
    return tx
        .update(storageContainers)
        .set({ name, updatedAt: new Date() })
        .where(eq(storageContainers.id, id))
        .returning()
        .get();
}

export function updateCase(id: string, fields: CaseFields, tx: Tx): StorageCase | undefined {
    return tx
        .update(storageCases)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(storageCases.id, id))
        .returning()
        .get();
}

/** Marks the container changed, as its cases are: a draft read before then is refused. */
export function touchContainer(id: string, tx: Tx): void {
    tx.update(storageContainers)
        .set({ updatedAt: new Date() })
        .where(eq(storageContainers.id, id))
        .run();
}

/** Names each case of `ids` after its id, which no other case is named. */
export function nameCasesAfterTheirIds(ids: string[], tx: Tx): void {
    tx.update(storageCases)
        .set({ name: storageCases.id })
        .where(inArray(storageCases.id, ids))
        .run();
}

/** The position after the last case of each container that has cases. */
export function nextCasePositions(tx: Tx): Map<string, number> {
    const rows = tx
        .select({
            containerId: storageCases.containerId,
            next: sql<number>`max(${storageCases.position}) + 1`
        })
        .from(storageCases)
        .groupBy(storageCases.containerId)
        .all();
    return new Map(rows.map(({ containerId, next }) => [containerId, next]));
}

/** The ids of the cases of a container. */
export function caseIdsOf(containerId: string, tx: Tx): string[] {
    return tx
        .select({ id: storageCases.id })
        .from(storageCases)
        .where(eq(storageCases.containerId, containerId))
        .all()
        .map(({ id }) => id);
}

/** Deletes the container, once it has no case left. */
export function removeContainer(id: string, tx: Tx): StorageContainer | undefined {
    return tx.delete(storageContainers).where(eq(storageContainers.id, id)).returning().get();
}

/** Deletes the cases of `ids`; returns how many there were. */
export function deleteCases(ids: string[], tx: Tx): number {
    return tx.delete(storageCases).where(inArray(storageCases.id, ids)).run().changes;
}

/**
 * A case with the number of bottles it holds: the available ones only, the bottles out of the
 * cellar keep their case but take no place in it. This is the occupancy of a case, everywhere.
 */
export interface CaseLoad {
    id: string;
    name: string;
    capacity: number;
    containerId: string;
    bottles: number;
}

/** The load of each case of `caseIds` that exists, or of every case, in the order of caseOrder. */
export function caseLoads(caseIds?: string[], tx: Tx = db): CaseLoad[] {
    return tx
        .select({
            id: storageCases.id,
            name: storageCases.name,
            capacity: storageCases.capacity,
            containerId: storageCases.containerId,
            bottles: count(wineBottles.id)
        })
        .from(storageCases)
        .leftJoin(wineBottles, and(eq(wineBottles.storageCaseId, storageCases.id), isAvailable))
        .where(caseIds && inArray(storageCases.id, caseIds))
        .groupBy(storageCases.id)
        .orderBy(...caseOrder)
        .all();
}

/**
 * The colour value of each available bottle in a case, by case, the bottles of one wine colour
 * together. Apart from caseLoads, which the writes run too: only the storage page needs it.
 */
export function bottleColorsByCase(): Map<string, string[]> {
    const rows = db
        .select({ caseId: wineBottles.storageCaseId, hex: wineColors.hex })
        .from(wineBottles)
        .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
        .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
        .where(and(isAvailable, isNotNull(wineBottles.storageCaseId)))
        .orderBy(wineColors.color)
        .all();
    const colors = new Map<string, string[]>();
    for (const { caseId, hex } of rows) {
        const ofCase = colors.get(caseId!) ?? colors.set(caseId!, []).get(caseId!)!;
        ofCase.push(hex);
    }
    return colors;
}

/**
 * The case of each available bottle of a wine that is stored somewhere; undefined when there is no
 * such wine.
 */
export function storedBottlesOfWine(definitionId: string): string[] | undefined {
    const rows = db
        .select({ caseId: wineBottles.storageCaseId })
        .from(wineDefinitions)
        .leftJoin(wineBottles, and(eq(wineBottles.definitionId, wineDefinitions.id), isAvailable))
        .where(eq(wineDefinitions.id, definitionId))
        .all();
    if (rows.length === 0) return undefined;
    return rows.flatMap(({ caseId }) => (caseId ? [caseId] : []));
}
