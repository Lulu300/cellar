import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles } from '#lib/server/db/schema.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { fakeEvent } from '../../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../../test/wine';
import { GET } from './+server';

const locationsOf = (id: string) =>
    GET(
        fakeEvent<Parameters<typeof GET>[0]>({
            path: `/api/wines/${id}/locations`,
            routeId: '/api/wines/[id]/locations',
            params: { id }
        })
    );

describe('GET /api/wines/[id]/locations', () => {
    let definitionId = '';
    beforeAll(async () => {
        definitionId = await insertWineDefinition();
    });

    it('counts the available bottles of the wine in each case that holds one', async () => {
        const { cases } = createContainer({ name: 'A', cases: ['1', '2'], caseCapacities: [6, 4] });
        const [a1, a2] = cases.map((storageCase) => storageCase.id);
        await insertBottles(definitionId, [
            { storageCaseId: a1, availability: 'available' },
            { storageCaseId: a1, availability: 'available' },
            { storageCaseId: a1, availability: 'out_of_cellar' },
            { storageCaseId: a2, availability: 'available' },
            { storageCaseId: null, availability: 'available' }
        ]);

        const response = await locationsOf(definitionId);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            definitionId,
            locations: [
                {
                    container: 'A',
                    case: 'A1',
                    caseId: a1,
                    count: 2,
                    capacity: 6,
                    totalBottlesInCase: 2
                },
                {
                    container: 'A',
                    case: 'A2',
                    caseId: a2,
                    count: 1,
                    capacity: 4,
                    totalBottlesInCase: 1
                }
            ],
            totalBottles: 3
        });
    });

    it('answers 404 for a wine that does not exist', async () => {
        const response = await locationsOf('none');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });

    it('answers no location for a wine without a stored bottle', async () => {
        await db.delete(wineBottles);
        await insertBottles(definitionId, [{ storageCaseId: null, availability: 'available' }]);

        const response = await locationsOf(definitionId);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ definitionId, locations: [], totalBottles: 0 });
    });
});
