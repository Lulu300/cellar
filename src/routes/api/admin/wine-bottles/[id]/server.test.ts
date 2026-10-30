import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../../test/wine';
import { DELETE } from './+server';

function deleteBottle(id: string) {
    return DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            path: `/api/admin/wine-bottles/${id}`,
            routeId: '/api/admin/wine-bottles/[id]',
            params: { id }
        })
    );
}

const bottleIds = async () => (await db.select().from(wineBottles)).map((bottle) => bottle.id);

describe('DELETE /api/admin/wine-bottles/[id]', () => {
    beforeAll(async () => {
        const definitionId = await insertWineDefinition();
        await insertBottles(definitionId, [{ id: 'b1' }, { id: 'b2' }]);
    });

    it('deletes the bottle and answers 204', async () => {
        const response = await deleteBottle('b1');

        expect(response.status).toBe(204);
        expect(await bottleIds()).toEqual(['b2']);
    });

    // As DELETE /api/bottles/{id} does.
    it('answers 404 for a bottle that does not exist, and deletes nothing', async () => {
        const response = await deleteBottle('unknown');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
        expect(await bottleIds()).toContain('b2');
    });
});
