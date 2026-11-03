import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

afterEach(() => {
    vi.useRealTimers();
});

describe('GET /api/bottles/to-drink', () => {
    it('gives the bottles to drink soon on the server clock, the most urgent first, with their rank and wine', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
        const definitionId = await insertWineDefinition();
        const [thisYear] = createBottles(bottleData(definitionId, { drinkBefore: '2026' }), 1);
        const [late] = createBottles(bottleData(definitionId, { drinkBefore: '2026-10' }), 1);
        createBottles(bottleData(definitionId, { drinkBefore: '2027' }), 1);
        createBottles(bottleData(definitionId), 1);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/bottles/to-drink' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject([
            { id: late.id, rank: 'late', drinkBefore: '2026-10' },
            {
                id: thisYear.id,
                rank: 'this_year',
                drinkBefore: '2026',
                format: 'Bottle',
                definition: { id: 'margaux', name: 'Château Margaux' }
            }
        ]);
    });
});
