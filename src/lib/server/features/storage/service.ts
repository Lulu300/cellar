import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import type { StorageCase, StorageContainer } from '#lib/server/db/schema.js';
import { ConflictError, NotFoundError } from '#lib/server/http/errors.js';
import { DEFAULT_CASE_CAPACITY } from '#lib/shared/schemas/storage.js';
import { containerLabel } from '#lib/shared/storage.js';
import { compareText } from '#lib/utils/compare.js';
import {
    allContainers,
    bottleColorsByCase,
    caseIdsOf,
    caseLoads,
    containerNamed,
    deleteCases,
    findContainer,
    insertCase,
    insertContainer,
    listCases as casesByCaseOrder,
    nameCasesAfterTheirIds,
    removeContainer,
    storedBottlesOfWine,
    updateCase,
    updateContainerName,
    type CaseFields,
    type CaseLoad
} from './repository';

/** The number of bottles in each case that holds one, as CaseLoad counts them. */
export function occupancy(): Record<string, number> {
    return Object.fromEntries(
        caseLoads()
            .filter(({ bottles }) => bottles > 0)
            .map(({ id, bottles }) => [id, bottles])
    );
}

/** Every container, in the order of the storage page: by the name it shows. */
export function listContainers(): StorageContainer[] {
    return allContainers().sort((a, b) =>
        compareText(containerLabel(a.name), containerLabel(b.name))
    );
}

/**
 * Every container, in the order of the storage page, with the `cases` that belong to it, in the
 * order they are given in.
 */
function byContainer<T extends { containerId: string }>(cases: T[]) {
    const casesByContainer = Map.groupBy(cases, ({ containerId }) => containerId);
    return listContainers().map((container) => ({
        container,
        cases: casesByContainer.get(container.id) ?? []
    }));
}

/**
 * What the storage page shows: every container, by the name it shows, with its cases in their order and the
 * bottles each one holds, as CaseLoad counts them, with the colour value of each in `colors`.
 */
export function storageOverview() {
    const colors = bottleColorsByCase();
    return byContainer(caseLoads()).map(({ container, cases }) => ({
        ...container,
        cases: cases.map((load) => ({ ...load, colors: colors.get(load.id) ?? [] }))
    }));
}

/** Every case, in the order of the storage page. */
export function listCases() {
    return byContainer(casesByCaseOrder()).flatMap(({ cases }) => cases);
}

/** A case would hold more available bottles than its capacity. */
class CaseFullError extends ConflictError {
    constructor({ name, capacity, bottles }: CaseLoad) {
        super(
            'case_full',
            `Case ${name} would hold ${bottles} bottles in the cellar, for a capacity of ${capacity}`,
            { caseName: name, capacity, bottles }
        );
    }
}

const overflow = ({ capacity, bottles }: CaseLoad) => Math.max(0, bottles - capacity);

/**
 * Runs `write` in a transaction, and undoes it with a CaseFullError when it leaves one of
 * `caseIds` with more available bottles beyond its capacity than it had: a case cannot get more
 * available bottles than its capacity. Data that already breaks the rule, from an import or an
 * older version, keeps working: a write that does not make a case fuller, such as a new note on
 * one of its bottles, goes through.
 */
export function keepingCasesWithinCapacity<T>(
    caseIds: (string | null | undefined)[],
    tx: Tx,
    write: (tx: Tx) => T
): T {
    const ids = [...new Set(caseIds.filter((id) => id != null))];
    return tx.transaction((tx) => {
        const before = new Map(caseLoads(ids, tx).map((load) => [load.id, overflow(load)]));
        const result = write(tx);
        const overfilled = caseLoads(ids, tx).find(
            (load) => overflow(load) > (before.get(load.id) ?? 0)
        );
        if (overfilled) throw new CaseFullError(overfilled);
        return result;
    });
}

/**
 * The cases of a container, in their order, from the suffixes and capacities that the storage page
 * sends.
 */
function caseFields(
    container: StorageContainer,
    cases: string[],
    capacities: (number | null | undefined)[]
) {
    return cases.map((suffix, position): CaseFields => ({
        name: `${container.name}${suffix}`,
        capacity: capacities[position] ?? DEFAULT_CASE_CAPACITY,
        position
    }));
}

export interface ContainerInput {
    name: string;
    /** The suffix of each case, appended to the container's name, in the order of the cases. */
    cases: string[];
    caseCapacities: (number | null | undefined)[];
}

/**
 * Throws a 409 when another container than `id` is named `name`, or when two cases get the same
 * suffix: the CSV files tell the containers apart by their names, and the cases by their container
 * and their names.
 */
function checkNames(id: string | null, { name, cases }: ContainerInput, tx: Tx): void {
    const named = containerNamed(name, tx);
    if (named && named.id !== id) {
        throw new ConflictError('duplicate_container', `A container is already named ${name}`, {
            name
        });
    }
    const position = cases.findIndex((suffix, i) => cases.indexOf(suffix) !== i);
    if (position !== -1) {
        const caseName = `${name}${cases[position]}`;
        throw new ConflictError(
            'duplicate_case',
            `The container would have two cases named ${caseName}`,
            { caseName, position }
        );
    }
}

/** Creates the container and its cases, or nothing. */
export function createContainer(input: ContainerInput) {
    const { name, cases, caseCapacities } = input;
    return db.transaction((tx) => {
        checkNames(null, input, tx);
        const container = insertContainer(name, tx);
        const created = caseFields(container, cases, caseCapacities).map((fields) =>
            insertCase(container.id, fields, tx)
        );
        return { container, cases: created };
    });
}

/** A case to delete still holds bottles that are in the cellar: they must be moved first. */
class CaseHoldsBottlesError extends ConflictError {
    constructor({ name, bottles }: CaseLoad) {
        super(
            'case_holds_bottles',
            `Case ${name} still holds ${bottles} bottle(s) in the cellar: move them first`,
            { caseName: name, bottles }
        );
    }
}

/**
 * Deletes the cases of `ids`, and returns how many there were. Throws CaseHoldsBottlesError when
 * one of them holds an available bottle. The bottles that left the cellar do not count: deleting
 * their case only clears it (ON DELETE SET NULL).
 */
function deleteEmptyCases(ids: string[], tx: Tx): number {
    const holding = caseLoads(ids, tx).find(({ bottles }) => bottles > 0);
    if (holding) throw new CaseHoldsBottlesError(holding);
    return deleteCases(ids, tx);
}

/**
 * Renames the container and replaces its cases, all or nothing: `cases` lists them all, in their
 * order. `caseIds` holds the id of each existing case, in the order of the suffixes, and nothing
 * for a case to create; a case of the container that it lacks is deleted. With `updatedAt`, the
 * time of the container that the caller read, a container changed since then is refused (409), so
 * that an old draft does not delete the case that another one created. Throws CaseFullError when
 * a capacity goes below the available bottles of its case, CaseHoldsBottlesError when a case to
 * delete holds one, and NotFoundError for an id that is not a case of the container.
 */
export function updateContainer(
    id: string,
    input: ContainerInput & { caseIds: (string | null | undefined)[]; updatedAt?: string }
): { container: StorageContainer; cases: StorageCase[] } {
    const { name, cases, caseCapacities, caseIds, updatedAt } = input;
    const updated = keepingCasesWithinCapacity(caseIds, db, (tx) => {
        const current = findContainer(id, tx);
        if (!current) return null;
        if (updatedAt !== undefined && current.updatedAt.getTime() !== Date.parse(updatedAt)) {
            throw new ConflictError(
                'container_changed',
                'The container changed after updatedAt: read it again',
                { updatedAt: current.updatedAt }
            );
        }
        checkNames(id, input, tx);
        const container = updateContainerName(id, name, tx)!;

        const existing = new Set(caseIdsOf(id, tx));
        if (caseIds.some((caseId) => caseId && !existing.has(caseId))) {
            throw new NotFoundError('Case not found in this container');
        }
        deleteEmptyCases(
            [...existing].filter((caseId) => !caseIds.includes(caseId)),
            tx
        );
        // Kept cases may swap names, as A1 and A2 do when they swap places: each first takes a
        // name that no case has, so that the unique names never refuse one of the updates.
        nameCasesAfterTheirIds(
            caseIds.filter((caseId) => caseId != null),
            tx
        );
        const updatedCases = caseFields(container, cases, caseCapacities).map((fields, i) => {
            const caseId = caseIds[i];
            return caseId ? updateCase(caseId, fields, tx)! : insertCase(container.id, fields, tx);
        });
        return { container, cases: updatedCases };
    });
    if (!updated) throw new NotFoundError('Container not found');
    return updated;
}

/**
 * Deletes the container with its cases, all or nothing. Throws CaseHoldsBottlesError when one of
 * its cases holds an available bottle.
 */
export function deleteContainer(id: string): void {
    const deleted = db.transaction((tx) => {
        deleteEmptyCases(caseIdsOf(id, tx), tx);
        return removeContainer(id, tx);
    });
    if (!deleted) throw new NotFoundError('Container not found');
}

/** Deletes the case. Throws CaseHoldsBottlesError when it holds an available bottle. */
export function deleteStorageCase(id: string): void {
    const deleted = db.transaction((tx) => deleteEmptyCases([id], tx));
    if (!deleted) throw new NotFoundError('Case not found');
}

/** How full the case is, for the forms that put bottles in it. */
export function caseCapacity(id: string) {
    const [load] = caseLoads([id]);
    if (!load) throw new NotFoundError('Storage case not found');
    const { name, capacity, bottles } = load;
    return {
        storageCase: { id, name, capacity },
        currentCount: bottles,
        availableSpots: Math.max(0, capacity - bottles),
        isFull: bottles >= capacity,
        capacity
    };
}

/**
 * Where the available bottles of a wine are, case by case in the order of the storage page, with
 * how full each case is. Throws a NotFoundError for an unknown wine.
 */
export function wineLocations(definitionId: string) {
    const stored = storedBottlesOfWine(definitionId);
    if (!stored) throw new NotFoundError('Wine definition not found');
    const counts = new Map<string, number>();
    for (const caseId of stored) {
        counts.set(caseId, (counts.get(caseId) ?? 0) + 1);
    }
    const locations = byContainer(caseLoads([...counts.keys()])).flatMap(({ container, cases }) =>
        cases.map((load) => ({
            container: container.name,
            case: load.name,
            caseId: load.id,
            count: counts.get(load.id) ?? 0,
            capacity: load.capacity,
            totalBottlesInCase: load.bottles
        }))
    );
    return {
        definitionId,
        locations,
        totalBottles: locations.reduce((sum, location) => sum + location.count, 0)
    };
}
