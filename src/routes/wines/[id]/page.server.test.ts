import { isHttpError } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
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
    return load({ ...event, depends: () => {} } as Event) as Promise<PageServerData>;
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
    it('loads the wine with its own bottles only', async () => {
        const data = await loadWine(margaux);

        expect(data.wineDefinition.name).toBe('Château Margaux');
        expect(data.bottles.map((bottle) => bottle.id).sort()).toEqual([...ownBottles].sort());
        expect(data.photos).toEqual([]);
    });

    it('sends the URLs of its photos only', async () => {
        expect((await loadWine('angelus')).photos).toEqual([
            { imageId: 'label', url: '/uploads/wines/angelus.jpg', main: true }
        ]);
    });

    it('answers 404 for an unknown wine', async () => {
        const failure = await loadWine('unknown').catch((error: unknown) => error);

        expect(isHttpError(failure, 404)).toBe(true);
    });

    // The page offers to remove the target only while the wine is short of it (UI-36).
    it.each([
        [null, false],
        [3, true],
        [2, false],
        [1, false]
    ])(
        'says whether the wine is in shortage, with a target of %s for 2 bottles',
        async (target, expected) => {
            await db
                .update(wineDefinitions)
                .set({ targetQuantity: target })
                .where(eq(wineDefinitions.id, margaux));

            expect((await loadWine(margaux)).inShortage).toBe(expected);
        }
    );
});
