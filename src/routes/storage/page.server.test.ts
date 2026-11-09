import { beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '#lib/server/features/storage/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../test/event';
import { insertBottles, insertWineDefinition } from '../../test/wine';
import type { PageServerData } from './$types';
import { load } from './+page.server';

type Event = Parameters<typeof load>[0];

function loadStorage(query = '') {
    const event = fakeEvent<Event>({ path: `/storage${query}`, routeId: '/storage' });
    return load({ ...event, depends: () => {} } as Event) as PageServerData;
}

let margaux: string;
let rack: string[];

beforeAll(async () => {
    margaux = await insertWineDefinition();
    const { cases } = createContainer({
        name: 'Rack',
        cases: ['1', '2', '3'],
        caseCapacities: [6, 6, 6]
    });
    rack = cases.map(({ id }) => id);
    await insertBottles(margaux, [
        { storageCaseId: rack[2], availability: BottleAvailability.AVAILABLE },
        { storageCaseId: rack[0], availability: BottleAvailability.AVAILABLE },
        { storageCaseId: rack[0], availability: BottleAvailability.AVAILABLE },
        // Out of the cellar, it keeps its case without being in it.
        {
            storageCaseId: rack[1],
            availability: BottleAvailability.OUT_OF_CELLAR,
            drinkBefore: '2026-11'
        },
        { storageCaseId: rack[2], availability: BottleAvailability.AVAILABLE, optimum: 2024 },
        {
            storageCaseId: rack[2],
            availability: BottleAvailability.AVAILABLE,
            drinkFrom: '2025',
            drinkBefore: '2027'
        },
        { availability: BottleAvailability.AVAILABLE, drinkBefore: '2026' }
    ]);
});

describe('the load of /storage', () => {
    it('highlights the cases holding the wine of ?wine=, in the order of the page', () => {
        expect(loadStorage(`?wine=${margaux}`).highlight).toEqual({
            id: margaux,
            name: 'Château Margaux',
            cases: [
                { id: rack[0], name: 'Rack1' },
                { id: rack[2], name: 'Rack3' }
            ]
        });
    });

    it('highlights nothing without a wine, or for a wine that does not exist', () => {
        expect(loadStorage().highlight).toBeNull();
        expect(loadStorage('?wine=unknown').highlight).toBeNull();
    });

    // The storage marker (FEAT-05): the browser ranks them within the horizon it is set to.
    it('gives the dates of the bottles in the cellar that a case holds, and only those', () => {
        expect(loadStorage().drinking).toEqual(
            expect.arrayContaining([
                { storageCaseId: rack[2], drinkFrom: null, drinkBefore: null, optimum: 2024 },
                { storageCaseId: rack[2], drinkFrom: '2025', drinkBefore: '2027', optimum: null }
            ])
        );
        expect(loadStorage().drinking).toHaveLength(2);
    });
});
