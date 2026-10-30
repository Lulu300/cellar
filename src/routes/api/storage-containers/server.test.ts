import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { storageCases, storageContainers } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { failWrites } from '../../../test/failing-write';
import { GET, POST } from './+server';

type Event = Parameters<typeof POST>[0];

const post = (body: unknown) =>
    POST(
        fakeEvent<Event>({
            method: 'POST',
            path: '/api/storage-containers',
            routeId: '/api/storage-containers',
            body
        })
    );

describe('POST /api/storage-containers', () => {
    it('creates the container with its cases', async () => {
        const response = await post({ name: 'Rack', capacity: 10, cases: ['1', '2'] });

        expect(response.status).toBe(201);
        expect((await db.select().from(storageCases)).map((c) => c.name)).toEqual([
            'Rack1',
            'Rack2'
        ]);
    });

    it('creates nothing when one of the cases cannot be inserted', async () => {
        const containersBefore = await db.select().from(storageContainers);
        const casesBefore = await db.select().from(storageCases);
        failWrites('INSERT', 'storage_cases', "NEW.name = 'Cellar2'");

        const response = await post({ name: 'Cellar', capacity: 10, cases: ['1', '2', '3'] });

        expect(response.status).toBe(500);
        expect(await db.select().from(storageContainers)).toEqual(containersBefore);
        expect(await db.select().from(storageCases)).toEqual(casesBefore);
    });

    it('keeps a space typed before a suffix, and drops those after it', async () => {
        const response = await post({ name: ' Fridge ', cases: [' top', '2  ', '  '] });

        expect(response.status).toBe(201);
        const { cases } = await response.json();
        expect(cases.map(({ name }: { name: string }) => name)).toEqual([
            'Fridge top',
            'Fridge2',
            'Fridge'
        ]);
    });

    it('answers 409 to a container name that is taken', async () => {
        await post({ name: 'Taken', cases: ['1'] });

        const response = await post({ name: 'Taken', cases: ['1'] });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'duplicate_container',
            details: { name: 'Taken' }
        });
    });

    it.each([
        ['no name', { capacity: 10, cases: ['1'] }],
        ['cases that are not a list', { name: 'Rack', capacity: 10, cases: '1,2' }],
        ['a case capacity of 0', { name: 'Rack', capacity: 10, cases: ['1'], caseCapacities: [0] }]
    ])('answers 422 to %s, and creates nothing', async (_, body) => {
        const before = await db.select().from(storageContainers);

        expect((await post(body)).status).toBe(422);
        expect(await db.select().from(storageContainers)).toEqual(before);
    });
});

describe('GET /api/storage-containers', () => {
    beforeEach(async () => {
        await db.delete(storageCases);
        await db.delete(storageContainers);
    });

    it('lists the containers in the order of the storage page, without their cases', async () => {
        for (const name of ['Shelf', 'Column B', 'rack']) await post({ name, cases: ['1'] });

        const response = await GET(fakeEvent<Event>({ path: '/api/storage-containers' }));

        expect(response.status).toBe(200);
        // "Column B" shows as B; the case does not count.
        expect(await response.json()).toEqual(
            ['Column B', 'rack', 'Shelf'].map((name) => ({
                id: expect.any(String),
                name,
                parentContainerId: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            }))
        );
    });
});
