import { beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '#lib/server/features/storage/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../../test/wine';
import { GET } from './+server';

const capacityOf = (id: string) =>
    GET(
        fakeEvent<Parameters<typeof GET>[0]>({
            path: `/api/storage-cases/${id}/capacity`,
            routeId: '/api/storage-cases/[id]/capacity',
            params: { id }
        })
    );

let fullCase: string;
let emptyCase: string;

beforeAll(async () => {
    const definitionId = await insertWineDefinition();
    const { cases } = createContainer({ name: 'Rack', cases: ['1', '2'], caseCapacities: [2, 6] });
    [fullCase, emptyCase] = cases.map((c) => c.id);
    await insertBottles(
        definitionId,
        [
            BottleAvailability.AVAILABLE,
            BottleAvailability.AVAILABLE,
            BottleAvailability.CONSUMED
        ].map((availability) => ({ storageCaseId: fullCase, availability }))
    );
});

describe('GET /api/storage-cases/[id]/capacity', () => {
    it('counts the available bottles of the case only', async () => {
        const response = await capacityOf(fullCase);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            storageCase: { id: fullCase, name: 'Rack1', capacity: 2 },
            currentCount: 2,
            availableSpots: 0,
            isFull: true,
            capacity: 2
        });
    });

    it('gives the free spots of a case that is not full', async () => {
        expect(await (await capacityOf(emptyCase)).json()).toMatchObject({
            currentCount: 0,
            availableSpots: 6,
            isFull: false
        });
    });

    it('answers 404 for a case that does not exist', async () => {
        const response = await capacityOf('no-such-case');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });
});
