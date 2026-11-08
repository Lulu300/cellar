import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../test/event';
import { bottleData, insertWineDefinition } from '../../test/wine';
import type { PageServerData } from './$types';
import { load } from './+page.server';

type Event = Parameters<typeof load>[0];

function loadPage() {
    const event = fakeEvent<Event>({ path: '/to-drink', routeId: '/to-drink' });
    return load({ ...event, depends: () => {} } as Event) as PageServerData;
}

let late: string, thisMonth: string, optimum: string, oldOptimum: string;

beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 15), toFake: ['Date'] });
    const definitionId = await insertWineDefinition();
    const add = (fields: Record<string, unknown>) =>
        createBottles(bottleData(definitionId, fields), 1)[0].id;
    optimum = add({ optimum: 2024 });
    late = add({ drinkBefore: '2026-09' });
    oldOptimum = add({ optimum: 2012 });
    thisMonth = add({ drinkBefore: '2026-11' });
    add({ drinkBefore: '2027' });
    add({});
    add({ drinkBefore: '2026-10', availability: BottleAvailability.OUT_OF_CELLAR });
    add({
        drinkBefore: '2026-10',
        availability: BottleAvailability.CONSUMED,
        consumedDate: '2026-10-20'
    });
});

afterAll(() => vi.useRealTimers());

describe('the load of /to-drink', () => {
    it('gives every bottle in the cellar to drink soon, the most urgent first, with its rank', () => {
        const { bottles } = loadPage();

        expect(bottles.map(({ id, rank }) => [id, rank])).toEqual([
            [late, 'late'],
            [thisMonth, 'this_month'],
            [oldOptimum, 'optimum_reached'],
            [optimum, 'optimum_reached']
        ]);
    });

    it('gives each bottle its wine, with the colour the filter reads', () => {
        const [bottle] = loadPage().bottles;

        expect(bottle.definition).toMatchObject({
            id: 'margaux',
            name: 'Château Margaux',
            colorId: 'red',
            color: 'Red'
        });
    });
});
