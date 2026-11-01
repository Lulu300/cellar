import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    storageCases,
    storageContainers,
    wineBottles,
    wineColors,
    wineDefinitions
} from '#lib/server/db/schema.js';
import type { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { failWrites } from '../../../../test/failing-write';
import { insertWineDefinition } from '../../../../test/wine';
import {
    caseCapacity,
    createContainer,
    deleteContainer,
    deleteStorageCase,
    keepingCasesWithinCapacity,
    listCases,
    occupancy,
    storageOverview,
    updateContainer,
    wineLocations
} from './service';

let wineId: string;

beforeAll(async () => {
    wineId = await insertWineDefinition();
});

beforeEach(() => {
    db.delete(wineBottles).run();
    db.delete(storageCases).run();
    db.delete(storageContainers).run();
});

/** Rack A with a case A1 of `capacity`; returns the ids. */
function rack(capacity: number) {
    const { container, cases } = createContainer({
        name: 'A',
        cases: ['1'],
        caseCapacities: [capacity]
    });
    return { containerId: container.id, caseId: cases[0].id };
}

/**
 * Puts bottles in the case directly, as an import or an older version could, beyond its
 * capacity.
 */
function putBottles(caseId: string, count: number, availability: BottleAvailability = 'available') {
    const now = new Date();
    for (let i = 0; i < count; i++) {
        db.insert(wineBottles)
            .values({
                id: randomUUID(),
                definitionId: wineId,
                formatId: 'bottle',
                storageCaseId: caseId,
                availability,
                createdAt: now,
                updatedAt: now
            })
            .run();
    }
}

const caseFull = expect.objectContaining({ status: 409, code: 'case_full' });

describe('updateContainer', () => {
    const edit = (containerId: string, caseId: string, capacity: number, name = 'A') =>
        updateContainer(containerId, {
            name,
            cases: ['1'],
            caseCapacities: [capacity],
            caseIds: [caseId]
        });

    it('refuses a capacity below the available bottles of the case, and changes nothing', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 3);

        expect(() => edit(containerId, caseId, 2, 'B')).toThrow(caseFull);
        expect(db.select().from(storageContainers).get()?.name).toBe('A');
        expect(caseCapacity(caseId)).toMatchObject({ capacity: 5, currentCount: 3 });
    });

    it('names the case and its numbers in the refusal', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 3);

        expect(() => edit(containerId, caseId, 2)).toThrow(
            expect.objectContaining({ details: { caseName: 'A1', capacity: 2, bottles: 3 } })
        );
    });

    it('lowers a capacity down to the bottles of the case', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 3);

        expect(edit(containerId, caseId, 3).cases[0].capacity).toBe(3);
    });

    it('does not count the bottles that left the cellar', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 3, 'out_of_cellar');

        expect(edit(containerId, caseId, 1).cases[0].capacity).toBe(1);
    });

    it('still edits a case that is already over its capacity, without making it fuller', () => {
        const { containerId, caseId } = rack(2);
        putBottles(caseId, 4);

        expect(edit(containerId, caseId, 2, 'B').container.name).toBe('B');
        expect(edit(containerId, caseId, 3).cases[0].capacity).toBe(3);
        expect(() => edit(containerId, caseId, 1)).toThrow(caseFull);
    });

    it('updates the container and its cases all or nothing', () => {
        const { containerId, caseId } = rack(5);
        failWrites('INSERT', 'storage_cases', "NEW.name = 'B2'");

        expect(() =>
            updateContainer(containerId, {
                name: 'B',
                cases: ['1', '2'],
                caseCapacities: [6, 6],
                caseIds: [caseId, null]
            })
        ).toThrow();
        expect(db.select().from(storageContainers).get()?.name).toBe('A');
        expect(caseCapacity(caseId).capacity).toBe(5);
    });

    it('answers 404 for a container that does not exist', () => {
        expect(() => edit('nowhere', 'none', 5)).toThrow(expect.objectContaining({ status: 404 }));
    });
});

describe('keepingCasesWithinCapacity', () => {
    it('undoes a write that puts a case over its capacity', () => {
        const { caseId } = rack(1);

        expect(() => keepingCasesWithinCapacity([caseId], db, () => putBottles(caseId, 2))).toThrow(
            caseFull
        );
        expect(occupancy()).toEqual({});
    });

    it('keeps a write that leaves a case as full as it was', () => {
        const { caseId } = rack(1);
        putBottles(caseId, 3);

        keepingCasesWithinCapacity([caseId], db, () =>
            db.update(wineBottles).set({ notes: 'Kept for a wedding' }).run()
        );
        expect(occupancy()).toEqual({ [caseId]: 3 });
    });
});

describe('deleting', () => {
    it('refuses a case or a container that holds an available bottle, naming the case', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 2);

        const holdsBottles = expect.objectContaining({
            status: 409,
            code: 'case_holds_bottles',
            details: { caseName: 'A1', bottles: 2 }
        });
        expect(() => deleteStorageCase(caseId)).toThrow(holdsBottles);
        expect(() => deleteContainer(containerId)).toThrow(holdsBottles);
        expect(db.select().from(storageCases).all()).toHaveLength(1);
    });

    it('deletes a container with its cases when only bottles out of the cellar are in them', () => {
        const { containerId, caseId } = rack(5);
        putBottles(caseId, 1, 'out_of_cellar');

        deleteContainer(containerId);

        expect(db.select().from(storageCases).all()).toEqual([]);
        expect(db.select().from(wineBottles).get()?.storageCaseId).toBeNull();
    });
});

describe('caseCapacity and wineLocations', () => {
    it('count the available bottles only', () => {
        const { caseId } = rack(4);
        putBottles(caseId, 2);
        putBottles(caseId, 1, 'out_of_cellar');

        expect(caseCapacity(caseId)).toMatchObject({
            currentCount: 2,
            availableSpots: 2,
            isFull: false
        });
        expect(wineLocations(wineId)).toEqual({
            definitionId: wineId,
            locations: [
                {
                    container: 'A',
                    case: 'A1',
                    caseId,
                    count: 2,
                    capacity: 4,
                    totalBottlesInCase: 2
                }
            ],
            totalBottles: 2
        });
    });
});

/** The names of the cases of each container, as the storage page shows them. */
const overviewNames = () =>
    Object.fromEntries(
        storageOverview().map(({ name, cases }) => [name, cases.map((c) => c.name)])
    );

describe('the cases of a container', () => {
    it('keep the order they are given in, whatever their names', () => {
        const { container } = createContainer({
            name: 'A',
            cases: ['10', '2', 'top', '1'],
            caseCapacities: []
        });

        expect(overviewNames()).toEqual({ A: ['A10', 'A2', 'Atop', 'A1'] });

        const [ten, two, top, one] = storageOverview()[0].cases.map(({ id }) => id);
        updateContainer(container.id, {
            name: 'A',
            cases: ['1', '2', '10', 'top'],
            caseCapacities: [],
            caseIds: [one, two, ten, top]
        });
        expect(overviewNames()).toEqual({ A: ['A1', 'A2', 'A10', 'Atop'] });
    });

    it('are told apart by id when two containers give the same name', () => {
        const a1 = createContainer({ name: 'A1', cases: ['1'], caseCapacities: [4] });
        const a = createContainer({ name: 'A', cases: ['1', '11'], caseCapacities: [4, 6] });
        putBottles(a1.cases[0].id, 3);
        putBottles(a.cases[1].id, 1);

        const overview = storageOverview();

        expect(
            overview.map(({ name, cases }) => [name, cases.map((c) => [c.name, c.bottles])])
        ).toEqual([
            [
                'A',
                [
                    ['A1', 0],
                    ['A11', 1]
                ]
            ],
            ['A1', [['A11', 3]]]
        ]);
    });

    it('come with the colour value of each bottle in the cellar, those of a colour together', () => {
        const now = new Date();
        db.insert(wineColors)
            .values({ id: 'white', color: 'White', hex: '#eeddaa', createdAt: now })
            .onConflictDoNothing()
            .run();
        db.insert(wineDefinitions)
            .values({
                id: 'blanc',
                name: 'Blanc',
                appellationId: 'mgx',
                typeId: 'still',
                colorId: 'white',
                createdAt: now
            })
            .onConflictDoNothing()
            .run();
        const { caseId } = rack(6);
        const red = db.select().from(wineColors).where(eq(wineColors.id, 'red')).get()!.hex;
        putBottles(caseId, 1);
        for (const availability of ['available', 'consumed'] as const) {
            db.insert(wineBottles)
                .values({
                    definitionId: 'blanc',
                    formatId: 'bottle',
                    storageCaseId: caseId,
                    availability
                })
                .run();
        }
        putBottles(caseId, 1);
        putBottles(caseId, 1, 'out_of_cellar');

        const [load] = storageOverview()[0].cases;

        expect(load.bottles).toBe(3);
        expect(load.colors).toEqual([red, red, '#eeddaa']);
    });

    // Up to 0.7.0, the page sorted them by the name it shows, without "Column ".
    it('come in containers ordered by the name the page shows', () => {
        for (const name of ['Column B', 'Box Z', 'Column A']) {
            createContainer({ name, cases: ['1'], caseCapacities: [] });
        }

        expect(storageOverview().map(({ name }) => name)).toEqual([
            'Column A',
            'Column B',
            'Box Z'
        ]);
    });

    it('that share a position, from an older file, keep the order of earlier versions', () => {
        const { container } = createContainer({ name: 'B', cases: [], caseCapacities: [] });
        const now = new Date();
        db.insert(storageCases)
            .values(
                ['B10', 'B2', 'Bx', 'B1'].map((name) => ({
                    id: randomUUID(),
                    name,
                    capacity: 6,
                    containerId: container.id,
                    createdAt: now,
                    updatedAt: now
                }))
            )
            .run();

        expect(overviewNames()).toEqual({ B: ['Bx', 'B1', 'B2', 'B10'] });
    });
});

describe('the other lists of cases', () => {
    /**
     * Two containers whose cases, sorted by name, would come in another order than on the storage
     * page: "Box Z" goes after "Column B", shown as "B", and the cases of "Column B" are not in
     * the order of their names.
     */
    function cellarWhereNamesMislead() {
        createContainer({ name: 'Box Z', cases: ['1'], caseCapacities: [] });
        createContainer({ name: 'Column B', cases: ['10', '2', '1'], caseCapacities: [] });
        return ['Column B10', 'Column B2', 'Column B1', 'Box Z1'];
    }

    it('come in the order of the storage page from listCases', () => {
        const pageOrder = cellarWhereNamesMislead();

        expect(listCases().map(({ name }) => name)).toEqual(pageOrder);
    });

    it('come in the order of the storage page from wineLocations', () => {
        const pageOrder = cellarWhereNamesMislead();
        for (const { id } of db.select().from(storageCases).all()) putBottles(id, 1);

        expect(wineLocations(wineId).locations.map((location) => location.case)).toEqual(pageOrder);
    });
});

describe('updateContainer replacing the cases', () => {
    /** Container A with cases A1 to A3 of capacity 6; returns its id and theirs. */
    function threeCases() {
        const { container, cases } = createContainer({
            name: 'A',
            cases: ['1', '2', '3'],
            caseCapacities: [6, 6, 6]
        });
        return { containerId: container.id, ids: cases.map(({ id }) => id) };
    }

    const keep = (containerId: string, ids: string[], suffixes: string[]) =>
        updateContainer(containerId, {
            name: 'A',
            cases: suffixes,
            caseCapacities: [],
            caseIds: ids
        });

    it('deletes the cases it no longer lists', () => {
        const { containerId, ids } = threeCases();
        putBottles(ids[1], 2, 'out_of_cellar');

        keep(containerId, [ids[0], ids[2]], ['1', '3']);

        expect(overviewNames()).toEqual({ A: ['A1', 'A3'] });
        // The bottles out of the cellar only lose their case.
        expect(
            db
                .select()
                .from(wineBottles)
                .all()
                .map((b) => b.storageCaseId)
        ).toEqual([null, null]);
    });

    it('refuses to delete a case that holds an available bottle, and changes nothing', () => {
        const { containerId, ids } = threeCases();
        putBottles(ids[1], 2);
        const before = db.select().from(storageCases).all();

        expect(() =>
            updateContainer(containerId, {
                name: 'B',
                cases: ['1', '3', '4'],
                caseCapacities: [],
                caseIds: [ids[0], ids[2]]
            })
        ).toThrow(
            expect.objectContaining({
                code: 'case_holds_bottles',
                details: { caseName: 'A2', bottles: 2 }
            })
        );
        expect(db.select().from(storageCases).all()).toEqual(before);
        expect(db.select().from(storageContainers).get()?.name).toBe('A');
    });

    it('refuses a case of another container, and changes nothing', () => {
        const { containerId, ids } = threeCases();
        const other = createContainer({ name: 'B', cases: ['1'], caseCapacities: [6] });
        const before = db.select().from(storageCases).all();

        expect(() => keep(containerId, [...ids, other.cases[0].id], ['1', '2', '3', '4'])).toThrow(
            expect.objectContaining({ status: 404 })
        );
        expect(db.select().from(storageCases).all()).toEqual(before);
    });
});

describe('occupancy', () => {
    it('is the same in every answer that gives it: the available bottles only', () => {
        const { caseId } = rack(6);
        putBottles(caseId, 2);
        putBottles(caseId, 1, 'out_of_cellar');
        putBottles(caseId, 1, 'consumed');

        expect(occupancy()).toEqual({ [caseId]: 2 });
        expect(storageOverview()[0].cases[0].bottles).toBe(2);
        expect(caseCapacity(caseId).currentCount).toBe(2);
        expect(wineLocations(wineId).locations[0].totalBottlesInCase).toBe(2);
    });
});

describe('the names of containers and cases', () => {
    const conflict = (code: string, details: object) =>
        expect.objectContaining({ status: 409, code, details });

    it('refuses a second container of a name, created or renamed, and changes nothing', () => {
        createContainer({ name: 'A', cases: ['1'], caseCapacities: [] });
        const b = createContainer({ name: 'B', cases: ['1'], caseCapacities: [] });
        const before = storageOverview();

        expect(() => createContainer({ name: 'A', cases: ['1'], caseCapacities: [] })).toThrow(
            conflict('duplicate_container', { name: 'A' })
        );
        expect(() =>
            updateContainer(b.container.id, {
                name: 'A',
                cases: ['1'],
                caseCapacities: [],
                caseIds: [b.cases[0].id]
            })
        ).toThrow(conflict('duplicate_container', { name: 'A' }));
        expect(storageOverview()).toEqual(before);
    });

    it('refuses two cases of a name in a container, naming the second one', () => {
        expect(() =>
            createContainer({ name: 'A', cases: ['1', '2', '1'], caseCapacities: [] })
        ).toThrow(conflict('duplicate_case', { caseName: 'A1', position: 2 }));
        expect(storageOverview()).toEqual([]);
    });

    it('lets two cases of a container swap their names', () => {
        const { container, cases } = createContainer({
            name: 'A',
            cases: ['1', '2'],
            caseCapacities: [4, 6]
        });

        updateContainer(container.id, {
            name: 'A',
            cases: ['2', '1'],
            caseCapacities: [4, 6],
            caseIds: cases.map(({ id }) => id)
        });

        expect(storageOverview()[0].cases.map(({ name, capacity }) => [name, capacity])).toEqual([
            ['A2', 4],
            ['A1', 6]
        ]);
    });
});

describe('updateContainer with the updatedAt of a draft', () => {
    /** Container A with case A1; returns its id, the body of a draft, and the time it read. */
    function draft() {
        const { container, cases } = createContainer({
            name: 'A',
            cases: ['1'],
            caseCapacities: []
        });
        return {
            id: container.id,
            body: { name: 'A', cases: ['1'], caseCapacities: [], caseIds: [cases[0].id] },
            updatedAt: container.updatedAt.toISOString()
        };
    }

    it('saves a container that did not change since', () => {
        const { id, body, updatedAt } = draft();

        expect(updateContainer(id, { ...body, updatedAt, name: 'B' }).container.name).toBe('B');
    });

    it('refuses a container changed since, rather than delete the case that another draft added', () => {
        const { id, body, updatedAt } = draft();
        updateContainer(id, { ...body, updatedAt, cases: ['1', '2'] });
        // The other draft saved at the next second at least.
        db.update(storageContainers)
            .set({ updatedAt: new Date(Date.parse(updatedAt) + 1000) })
            .run();

        expect(() => updateContainer(id, { ...body, updatedAt })).toThrow(
            expect.objectContaining({ status: 409, code: 'container_changed' })
        );
        expect(overviewNames()).toEqual({ A: ['A1', 'A2'] });
    });

    it('saves without updatedAt, as scripts of earlier versions do', () => {
        const { id, body } = draft();
        db.update(storageContainers)
            .set({ updatedAt: new Date(0) })
            .run();

        expect(updateContainer(id, { ...body, name: 'B' }).container.name).toBe('B');
    });
});
