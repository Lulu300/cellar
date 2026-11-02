import { beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '#lib/server/features/storage/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../../test/wine';
import { GET } from './+server';

const bottlesOf = (id: string) =>
    GET(
        fakeEvent<Parameters<typeof GET>[0]>({
            path: `/api/storage-cases/${id}/bottles`,
            routeId: '/api/storage-cases/[id]/bottles',
            params: { id }
        })
    );

let rack1: string;
let rack2: string;
let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
    const { cases } = createContainer({ name: 'Rack', cases: ['1', '2'], caseCapacities: [6, 6] });
    [rack1, rack2] = cases.map((c) => c.id);
    await insertBottles(definitionId, [
        { storageCaseId: rack1, availability: BottleAvailability.AVAILABLE, vintage: 2015 },
        { storageCaseId: rack1, availability: BottleAvailability.AVAILABLE, vintage: 2018 },
        { storageCaseId: rack1, availability: BottleAvailability.OUT_OF_CELLAR },
        // A drunk bottle keeps the case it was in (FEAT-12), without being there.
        { storageCaseId: rack1, availability: BottleAvailability.CONSUMED, vintage: 2010 },
        { storageCaseId: rack2, availability: BottleAvailability.AVAILABLE }
    ]);
});

describe('GET /api/storage-cases/[id]/bottles', () => {
    it('lists the available bottles of the case, with their wine, as the case counts them', async () => {
        const response = await bottlesOf(rack1);

        expect(response.status).toBe(200);
        const bottles = await response.json();
        expect(bottles.map((bottle: { vintage: number }) => bottle.vintage).sort()).toEqual([
            2015, 2018
        ]);
        expect(bottles[0]).toMatchObject({
            availability: BottleAvailability.AVAILABLE,
            storageCase: { id: rack1, name: 'Rack1', container: { name: 'Rack' } },
            definition: { id: definitionId, colorHex: expect.stringMatching(/^#[0-9a-f]{6}$/) }
        });
    });

    it('answers an empty list for an empty case', async () => {
        const { cases } = createContainer({ name: 'Empty', cases: ['1'], caseCapacities: [6] });
        expect(await (await bottlesOf(cases[0].id)).json()).toEqual([]);
    });

    it('answers 404 for a case that does not exist', async () => {
        const response = await bottlesOf('no-such-case');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });
});
