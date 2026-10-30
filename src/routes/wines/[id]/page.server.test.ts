import { isHttpError } from '@sveltejs/kit';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages } from '#lib/server/db/schema.js';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { fakeEvent } from '../../../test/event';
import { bottleData, insertWineDefinition } from '../../../test/wine';
import type { PageServerData } from './$types';
import { load } from './+page.server';

type Event = Parameters<typeof load>[0];

function loadWine(id: string) {
    const event = fakeEvent<Event>({
        path: `/wines/${id}`,
        routeId: '/wines/[id]',
        params: { id }
    });
    return load({ ...event, depends: () => {} } as Event) as PageServerData;
}

let margaux: string;
let ownBottles: string[];

beforeAll(async () => {
    margaux = await insertWineDefinition();
    const now = new Date();
    await db.insert(wineImages).values({
        id: 'label',
        filename: 'angelus.jpg',
        path: '/uploads/wines/',
        createdAt: now,
        updatedAt: now
    });
    await db.insert(wineDefinitions).values({
        id: 'angelus',
        name: 'Angélus',
        imageId: 'label',
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        createdAt: now,
        updatedAt: now
    });
    ownBottles = createBottles(bottleData(margaux), 2).map((bottle) => bottle.id);
    createBottles(bottleData('angelus'), 3);
});

describe('the load of /wines/[id]', () => {
    it('loads the wine with its own bottles only', () => {
        const data = loadWine(margaux);

        expect(data.wineDefinition.name).toBe('Château Margaux');
        expect(data.bottles.map((bottle) => bottle.id).sort()).toEqual([...ownBottles].sort());
        expect(data.imageUrl).toBeUndefined();
    });

    it('sends the URL of its image only', () => {
        expect(loadWine('angelus').imageUrl).toBe('/uploads/wines/angelus.jpg');
    });

    it('answers 404 for an unknown wine', () => {
        let failure: unknown;
        try {
            loadWine('unknown');
        } catch (error) {
            failure = error;
        }

        expect(isHttpError(failure, 404)).toBe(true);
    });
});
