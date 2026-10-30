import { beforeAll, describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../test/event';
import { bottleData, insertWineDefinition } from '../../test/wine';
import type { PageServerData } from './$types';
import { load } from './+page.server';

type Event = Parameters<typeof load>[0];

function loadPage(query: string) {
    const event = fakeEvent<Event>({
        path: `/cellar-history?${query}`,
        routeId: '/cellar-history'
    });
    return load({ ...event, depends: () => {} } as Event) as PageServerData;
}

const ids = (bottles: { id: string }[]) => bottles.map((bottle) => bottle.id);

let older: string, newer: string, drunk: string, drunkFirst: string;

beforeAll(async () => {
    const definitionId = await insertWineDefinition();
    const add = (fields: Record<string, unknown>) =>
        createBottles(bottleData(definitionId, fields), 1)[0].id;
    const consumed = (purchaseDate: string, consumedDate: string) =>
        add({ purchaseDate, availability: BottleAvailability.CONSUMED, consumedDate });
    older = add({ purchaseDate: '2020-01-01' });
    newer = add({ purchaseDate: '2023-01-01' });
    drunk = consumed('2021-01-01', '2024-01-01');
    drunkFirst = consumed('2019-01-01', '2022-01-01');
});

describe('the load of /cellar-history', () => {
    it('shows every bottle, the newest purchase first, by default', () => {
        const page = loadPage('');

        expect(page).toMatchObject({ filter: 'all', sort: 'purchaseDate', direction: 'desc' });
        expect(ids(page.bottles)).toEqual([newer, drunk, older, drunkFirst]);
    });

    it('sorts the consumed bottles by consumption date by default', () => {
        const page = loadPage('filter=consumed');

        expect(page).toMatchObject({ sort: 'consumedDate', direction: 'desc' });
        expect(ids(page.bottles)).toEqual([drunk, drunkFirst]);
    });

    it('sorts every bottle by consumption date, the bottles not drunk last', () => {
        const sorted = (dir: string) =>
            ids(loadPage(`filter=all&sort=consumedDate&dir=${dir}`).bottles);

        expect(sorted('asc').slice(0, 2)).toEqual([drunkFirst, drunk]);
        expect(sorted('desc').slice(0, 2)).toEqual([drunk, drunkFirst]);
        expect(sorted('asc').slice(2).sort()).toEqual([older, newer].sort());
    });

    it('has no consumption date column for the bottles in the cellar', () => {
        const page = loadPage('filter=in_cave&sort=consumedDate&dir=asc');

        expect(page.columns).not.toContain('consumedDate');
        expect(page).toMatchObject({ sort: 'purchaseDate', direction: 'desc' });
        expect(ids(page.bottles)).toEqual([newer, older]);
    });

    it('keeps a sort given in the URL whatever the filter', () => {
        for (const filter of ['all', 'in_cave', 'consumed']) {
            expect(loadPage(`filter=${filter}&sort=purchaseDate&dir=asc`)).toMatchObject({
                filter,
                sort: 'purchaseDate',
                direction: 'asc'
            });
        }
    });

    it('shows every bottle for an unknown filter', () => {
        expect(loadPage('filter=lost').filter).toBe('all');
    });
});
