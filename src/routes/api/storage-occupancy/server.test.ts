import { describe, expect, it } from 'vitest';
import { createContainer } from '#lib/server/features/storage/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../test/wine';
import { GET } from './+server';

describe('GET /api/storage-occupancy', () => {
    it('maps each case that holds an available bottle to their number', async () => {
        const definitionId = await insertWineDefinition();
        const { cases } = createContainer({
            name: 'Rack',
            cases: ['1', '2', '3'],
            caseCapacities: []
        });
        const [twoBottles, consumedOnly] = cases.map((c) => c.id);
        await insertBottles(definitionId, [
            { storageCaseId: twoBottles, availability: BottleAvailability.AVAILABLE },
            { storageCaseId: twoBottles, availability: BottleAvailability.AVAILABLE },
            { storageCaseId: twoBottles, availability: BottleAvailability.OUT_OF_CELLAR },
            { storageCaseId: consumedOnly, availability: BottleAvailability.CONSUMED }
        ]);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/storage-occupancy' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ [twoBottles]: 2 });
    });
});
