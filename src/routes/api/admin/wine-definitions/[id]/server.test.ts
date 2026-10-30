import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../../test/event';
import { failWrites } from '../../../../../test/failing-write';
import { insertWineDefinition } from '../../../../../test/wine';
import { DELETE } from './+server';

function deleteWine(id: string) {
    const event = fakeEvent<Parameters<typeof DELETE>[0]>({
        method: 'DELETE',
        path: `/api/admin/wine-definitions/${id}?cascade=true`,
        routeId: '/api/admin/wine-definitions/[id]',
        params: { id }
    });
    return DELETE(event);
}

describe('DELETE /api/admin/wine-definitions/[id]?cascade=true', () => {
    const now = new Date();
    const timestamps = { createdAt: now, updatedAt: now };
    let wine: typeof wineDefinitions.$inferSelect;

    beforeAll(async () => {
        const id = await insertWineDefinition();
        [wine] = await db.select().from(wineDefinitions).where(eq(wineDefinitions.id, id));
    });

    // The wine with two bottles, whatever the previous test deleted.
    beforeEach(async () => {
        await db.delete(wineBottles);
        await db.insert(wineDefinitions).values(wine).onConflictDoNothing();
        await db.insert(wineBottles).values(
            ['b1', 'b2'].map((id) => ({
                id,
                definitionId: wine.id,
                formatId: 'bottle',
                ...timestamps
            }))
        );
    });

    it('keeps the bottles when the wine cannot be deleted', async () => {
        failWrites('DELETE', 'wine_definitions', '1');

        const response = await deleteWine(wine.id);

        expect(response.status).toBe(500);
        expect(await db.select().from(wineBottles)).toHaveLength(2);
    });

    it('deletes the wine with its bottles', async () => {
        const response = await deleteWine(wine.id);

        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
        expect(await db.select().from(wineBottles)).toEqual([]);
        expect(await db.select().from(wineDefinitions)).toEqual([]);
    });
});
