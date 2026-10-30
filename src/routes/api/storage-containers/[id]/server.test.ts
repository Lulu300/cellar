import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    storageCases,
    storageContainers,
    wineBottles,
    wineFormats
} from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { insertWineDefinition } from '../../../../test/wine';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { DELETE, PUT } from './+server';

type Event = Parameters<typeof PUT>[0];

function request(method: 'PUT' | 'DELETE', id: string, body?: unknown) {
    const event = fakeEvent<Event>({
        method,
        path: `/api/storage-containers/${id}`,
        routeId: '/api/storage-containers/[id]',
        body,
        params: { id }
    });
    return method === 'PUT' ? PUT(event) : DELETE(event);
}

const now = new Date();
const timestamps = { createdAt: now, updatedAt: now };
let definitionId: string;

/** A container named `name` with the cases `name`1, `name`2 and `name`3. */
async function insertContainer(name: string) {
    const containerId = randomUUID();
    await db.insert(storageContainers).values({ id: containerId, name, ...timestamps });
    const caseIds = [1, 2, 3].map(() => randomUUID());
    await db.insert(storageCases).values(
        caseIds.map((id, index) => ({
            id,
            name: `${name}${index + 1}`,
            capacity: 6,
            containerId,
            ...timestamps
        }))
    );
    return { containerId, caseIds };
}

async function snapshot() {
    return {
        containers: await db.select().from(storageContainers),
        cases: await db.select().from(storageCases)
    };
}

beforeEach(async () => {
    await db.delete(wineBottles);
    await db.delete(storageCases);
    await db.delete(storageContainers);
    definitionId ??= await insertWineDefinition();
});

describe('PUT /api/storage-containers/[id]', () => {
    it('renames the container and its cases, and adds the new cases', async () => {
        const { containerId, caseIds } = await insertContainer('Rack');

        const response = await request('PUT', containerId, {
            name: 'Shelf',
            cases: ['1', '2', '3', '4'],
            caseIds: [...caseIds, null]
        });

        expect(response.status).toBe(200);
        expect((await db.select().from(storageCases)).map((c) => c.name).sort()).toEqual([
            'Shelf1',
            'Shelf2',
            'Shelf3',
            'Shelf4'
        ]);
    });

    it('changes nothing when a new case cannot be inserted', async () => {
        const { containerId, caseIds } = await insertContainer('Rack');
        const before = await snapshot();
        failWrites('INSERT', 'storage_cases', "NEW.name = 'Shelf5'");

        const response = await request('PUT', containerId, {
            name: 'Shelf',
            cases: ['1', '2', '3', '4', '5'],
            caseIds: [...caseIds, null, null]
        });

        expect(response.status).toBe(500);
        expect(await snapshot()).toEqual(before);
    });

    it('answers 409 and changes nothing when the container changed after the updatedAt sent', async () => {
        const { containerId, caseIds } = await insertContainer('Rack');
        const [{ updatedAt }] = await db.select().from(storageContainers);
        const body = { name: 'Rack', cases: ['1', '2', '3'], caseIds };
        const before = await snapshot();

        const stale = await request('PUT', containerId, {
            ...body,
            updatedAt: new Date(updatedAt.getTime() - 1000).toISOString()
        });

        expect(stale.status).toBe(409);
        expect((await stale.json()).error.code).toBe('container_changed');
        expect(await snapshot()).toEqual(before);
        const current = await request('PUT', containerId, {
            ...body,
            updatedAt: updatedAt.toISOString()
        });
        expect(current.status).toBe(200);
    });

    it.each([
        ['an id twice', (ids: string[]) => [ids[0], ids[0], ids[2]]],
        ['more ids than cases', (ids: string[]) => [...ids, randomUUID()]]
    ])('answers 422 and changes nothing for %s', async (_, caseIdsOf) => {
        const { containerId, caseIds } = await insertContainer('Rack');
        const before = await snapshot();

        const response = await request('PUT', containerId, {
            name: 'Rack',
            cases: ['1', '2', '3'],
            caseIds: caseIdsOf(caseIds)
        });

        expect(response.status).toBe(422);
        expect(await snapshot()).toEqual(before);
    });
});

describe('DELETE /api/storage-containers/[id]', () => {
    it('deletes the container and its cases', async () => {
        await insertContainer('Kept');
        const { containerId } = await insertContainer('Rack');

        const response = await request('DELETE', containerId);

        expect(response.status).toBe(204);
        expect((await db.select().from(storageContainers)).map((c) => c.name)).toEqual(['Kept']);
        expect(await db.select().from(storageCases)).toHaveLength(3);
    });

    it('answers 409 and deletes nothing when a case still holds a bottle', async () => {
        const { containerId, caseIds } = await insertContainer('Rack');
        await db.insert(wineBottles).values({
            id: randomUUID(),
            definitionId,
            formatId: 'bottle',
            storageCaseId: caseIds[2],
            ...timestamps
        });
        const before = await snapshot();

        const response = await request('DELETE', containerId);

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('case_holds_bottles');
        expect(await snapshot()).toEqual(before);
    });

    // Decision of 2026-10-08: the bottles that left the cellar only lose their case.
    it('deletes a container whose cases hold only bottles that left the cellar', async () => {
        const { containerId, caseIds } = await insertContainer('Rack');
        const formatId = randomUUID();
        await db.insert(wineFormats).values({ id: formatId, name: 'Magnum', ...timestamps });
        const bottleId = randomUUID();
        await db.insert(wineBottles).values({
            id: bottleId,
            definitionId,
            formatId,
            storageCaseId: caseIds[2],
            availability: BottleAvailability.OUT_OF_CELLAR,
            ...timestamps
        });

        const response = await request('DELETE', containerId);

        expect(response.status).toBe(204);
        expect(await snapshot()).toEqual({ containers: [], cases: [] });
        const [bottle] = await db.select().from(wineBottles).where(eq(wineBottles.id, bottleId));
        expect(bottle.storageCaseId).toBeNull();
    });

    it('keeps the cases when the container cannot be deleted', async () => {
        const { containerId } = await insertContainer('Rack');
        const before = await snapshot();
        failWrites('DELETE', 'storage_containers', '1');

        const response = await request('DELETE', containerId);

        expect(response.status).toBe(500);
        expect(await snapshot()).toEqual(before);
    });

    it('answers 404 for a container that does not exist', async () => {
        const response = await request('DELETE', 'no-such-container');

        expect(response.status).toBe(404);
    });
});
