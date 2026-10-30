import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    storageCases,
    storageContainers,
    wineBottles,
    wineFormats
} from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../../../../test/event';
import { insertWineDefinition } from '../../../../test/wine';
import { DELETE } from './+server';

const remove = (id: string) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            path: `/api/storage-cases/${id}`,
            routeId: '/api/storage-cases/[id]',
            params: { id }
        })
    );

const timestamps = { createdAt: new Date(), updatedAt: new Date() };
let definitionId: string;

beforeEach(async () => {
    await db.delete(wineBottles);
    await db.delete(storageCases);
    await db.delete(storageContainers);
    definitionId ??= await insertWineDefinition();
    await db
        .insert(wineFormats)
        .values({ id: 'bottle', name: 'Bottle', ...timestamps })
        .onConflictDoNothing();
    await db.insert(storageContainers).values({ id: 'rack', name: 'Rack', ...timestamps });
    await db.insert(storageCases).values({
        id: 'rack1',
        name: 'Rack1',
        capacity: 6,
        containerId: 'rack',
        ...timestamps
    });
});

async function insertBottleInRack1(id: string, availability: BottleAvailability) {
    await db.insert(wineBottles).values({
        id,
        definitionId,
        formatId: 'bottle',
        storageCaseId: 'rack1',
        availability,
        ...timestamps
    });
}

async function caseOf(bottleId: string) {
    const bottle = await db.select().from(wineBottles).where(eq(wineBottles.id, bottleId));
    return bottle[0].storageCaseId;
}

describe('DELETE /api/storage-cases/[id]', () => {
    it('answers 409 and keeps a case that still holds an available bottle', async () => {
        await insertBottleInRack1('in-cellar', BottleAvailability.AVAILABLE);
        await insertBottleInRack1('drunk', BottleAvailability.CONSUMED);

        const response = await remove('rack1');

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('case_holds_bottles');
        expect(await db.select().from(storageCases)).toHaveLength(1);
        expect(await caseOf('drunk')).toBe('rack1');
    });

    // Decision of 2026-10-08: the bottles that left the cellar only lose their case.
    it('deletes a case that holds only bottles that left the cellar, and unlinks them', async () => {
        await insertBottleInRack1('lent', BottleAvailability.OUT_OF_CELLAR);
        await insertBottleInRack1('drunk', BottleAvailability.CONSUMED);

        const response = await remove('rack1');

        expect(response.status).toBe(204);
        expect(await db.select().from(storageCases)).toEqual([]);
        expect(await caseOf('lent')).toBeNull();
        expect(await caseOf('drunk')).toBeNull();
    });

    it('answers 404 for a case that does not exist', async () => {
        const response = await remove('no-such-case');

        expect(response.status).toBe(404);
    });
});
