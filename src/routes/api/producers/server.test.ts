import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { producers, wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { insertProducer, insertWineDefinition } from '../../../test/wine';
import { POST as MERGE } from '../admin/merge-producers/+server';
import { DELETE, GET as GET_ONE, PUT } from './[id]/+server';
import { GET, POST } from './+server';

const post = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({ method: 'POST', routeId: '/api/producers', body })
    );
const put = (id: string, body: unknown) =>
    PUT(
        fakeEvent<Parameters<typeof PUT>[0]>({
            method: 'PUT',
            routeId: '/api/producers/[id]',
            params: { id },
            body
        })
    );
const getOne = (id: string) =>
    GET_ONE(
        fakeEvent<Parameters<typeof GET_ONE>[0]>({
            routeId: '/api/producers/[id]',
            params: { id }
        })
    );
const remove = (id: string) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            routeId: '/api/producers/[id]',
            params: { id }
        })
    );
const merge = (body: unknown) =>
    MERGE(
        fakeEvent<Parameters<typeof MERGE>[0]>({
            method: 'POST',
            routeId: '/api/admin/merge-producers',
            body
        })
    );

beforeAll(async () => {
    await insertWineDefinition();
});

beforeEach(() => {
    db.update(wineDefinitions).set({ producerId: null }).run();
    db.delete(producers).run();
});

describe('/api/producers', () => {
    it('creates a producer (201), then answers it for any spelling of its name (200)', async () => {
        const created = await post({
            name: 'Château  Margaux',
            website: 'https://margaux.example'
        });
        expect(created.status).toBe(201);
        const producer = await created.json();
        expect(producer).toMatchObject({ name: 'Château Margaux', wineCount: 0 });

        const again = await post({ name: 'chateau margaux' });
        expect(again.status).toBe(200);
        expect((await again.json()).id).toBe(producer.id);

        const list = await GET(fakeEvent<Parameters<typeof GET>[0]>({ routeId: '/api/producers' }));
        expect((await list.json()).map((row: { name: string }) => row.name)).toEqual([
            'Château Margaux'
        ]);
    });

    it('gives a producer with its wines, changes it, and answers 404 for an unknown one', async () => {
        const id = await insertProducer('Margaux SA');
        db.update(wineDefinitions).set({ producerId: id }).run();

        const details = await (await getOne(id)).json();
        expect(details).toMatchObject({ name: 'Margaux SA', wineCount: 1 });
        expect(details.wines.map((wine: { id: string }) => wine.id)).toEqual(['margaux']);

        const changed = await put(id, { name: 'Margaux SA', description: 'An estate' });
        expect(changed.status).toBe(200);
        expect(await changed.json()).toMatchObject({ description: 'An estate' });

        expect((await getOne('nobody')).status).toBe(404);
        expect((await put(id, { name: '' })).status).toBe(422);
    });

    it('refuses to delete a producer that wines use (409), and deletes it once none does (204)', async () => {
        const id = await insertProducer('Margaux SA');
        db.update(wineDefinitions).set({ producerId: id }).run();

        const refused = await remove(id);
        expect(refused.status).toBe(409);
        expect((await refused.json()).error).toMatchObject({
            code: 'in_use',
            details: { count: 1, usedBy: 'wine_definitions' }
        });

        db.update(wineDefinitions).set({ producerId: null }).run();
        expect((await remove(id)).status).toBe(204);
    });
});

describe('POST /api/admin/merge-producers', () => {
    it('names the fields to choose (409), then merges (200)', async () => {
        const keptId = (
            await (await post({ name: 'E. Guigal', website: 'https://a.example' })).json()
        ).id;
        const mergedId = (
            await (await post({ name: 'Guigal', website: 'https://b.example' })).json()
        ).id;
        db.update(wineDefinitions).set({ producerId: mergedId }).run();

        const refused = await merge({ keptId, mergedId });
        expect(refused.status).toBe(409);
        expect((await refused.json()).error).toMatchObject({
            code: 'merge_choice_needed',
            details: { fields: ['website'] }
        });

        const merged = await merge({ keptId, mergedId, choices: { website: 'kept' } });
        expect(merged.status).toBe(200);
        expect(await merged.json()).toMatchObject({
            id: keptId,
            website: 'https://a.example',
            wineCount: 1
        });
        expect((await getOne(mergedId)).status).toBe(404);
    });

    it('refuses a producer merged into itself (422)', async () => {
        const id = await insertProducer('Huet');
        expect((await merge({ keptId: id, mergedId: id })).status).toBe(422);
    });
});
