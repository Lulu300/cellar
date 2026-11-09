import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('GET /api/bottles/to-drink', () => {
    it('gives the bottles to drink soon on the server clock, the most urgent first, with their rank and wine', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
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

    // FEAT-19: the page lists the ready bottles after those at their optimum, and leaves out
    // those whose window has not opened.
    it('lists the ready bottles last, and not those not ready yet', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
        const bottle = (fields: Record<string, unknown>) =>
            createBottles(bottleData(definitionId, fields), 1)[0].id;
        const ready = bottle({ drinkFrom: '2024', drinkBefore: '2032', optimum: 2027 });
        const atOptimum = bottle({ drinkFrom: '2020', optimum: 2022 });
        bottle({ drinkFrom: '2028', drinkBefore: '2045' });

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/bottles/to-drink' })
        );

        const listed = ((await response.json()) as { id: string; rank: string }[])
            .filter(({ id }) => [ready, atOptimum].includes(id))
            .map(({ id, rank }) => ({ id, rank }));
        expect(listed).toEqual([
            { id: atOptimum, rank: 'optimum_reached' },
            { id: ready, rank: 'ready' }
        ]);
    });
});
