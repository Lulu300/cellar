import { describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { NEUTRAL_HEX } from '#lib/shared/wine-colors.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

describe('GET /api/bottles/non-consumed', () => {
    // The storage page edits these bottles, and the API takes their format by id only; the form
    // shows their « drink before ».
    it('gives the format and origin ids and the « drink before » of each bottle', async () => {
        const definitionId = await insertWineDefinition();
        createBottles(bottleData(definitionId, { drinkBefore: '2027' }), 1);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/bottles/non-consumed' })
        );

        expect(await response.json()).toMatchObject([
            { formatId: 'bottle', format: 'Bottle', originId: null, drinkBefore: '2027' }
        ]);
    });

    it('names the wine of each bottle `definition`, as the other bottle lists do', async () => {
        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/bottles/non-consumed' })
        );

        const [bottle] = await response.json();
        expect(bottle.definition).toEqual({
            id: 'margaux',
            name: 'Château Margaux',
            producer: null,
            appellation: 'Margaux',
            color: 'Red',
            colorHex: NEUTRAL_HEX
        });
        expect(bottle).not.toHaveProperty('wineDefinition');
    });
});
