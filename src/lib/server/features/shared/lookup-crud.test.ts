import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { origins, wineClassifications, wineDefinitions } from '#lib/server/db/schema.js';
import { createBottles } from '#lib/server/features/bottles/service.js';
import {
    originHandlers,
    wineClassificationHandlers,
    wineColorHandlers,
    wineFormatHandlers,
    wineTypeHandlers
} from '#lib/server/features/catalog/service.js';
import {
    appellationHandlers,
    countryHandlers,
    regionHandlers
} from '#lib/server/features/geography/service.js';
import { requiresSession } from '#lib/server/session.js';
import { NEUTRAL_HEX, startingHex } from '#lib/shared/wine-colors.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';

type Handlers = typeof wineTypeHandlers;

interface Request {
    method?: string;
    path: string;
    id?: string;
    body?: unknown;
}

/** Calls the handler of the collection or of one row, as the route does. */
async function send(handlers: Handlers, { method = 'GET', path, id, body }: Request) {
    const event = fakeEvent<never>({
        method,
        path: id ? `${path}/${id}` : path,
        params: id ? { id } : {},
        body
    });
    const handler = id
        ? handlers.item[method as 'PUT' | 'DELETE']
        : handlers.collection[method as 'GET' | 'POST'];
    const response = await handler(event);
    return {
        status: response.status,
        body: response.status === 204 ? null : await response.json()
    };
}

/**
 * Each table, with a row that another table uses (from insertWineDefinition and beforeAll) and the
 * parent that a new row needs.
 */
const TABLES = [
    {
        path: '/api/wine-types',
        handlers: wineTypeHandlers,
        used: { id: 'still', name: 'Still' },
        usedBy: 'wine_definitions',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/wine-colors',
        handlers: wineColorHandlers,
        used: { id: 'red', name: 'Red' },
        usedBy: 'wine_definitions',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/wine-classifications',
        handlers: wineClassificationHandlers,
        used: { id: 'gc', name: 'Grand Cru' },
        usedBy: 'wine_definitions',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/wine-formats',
        handlers: wineFormatHandlers,
        used: { id: 'bottle', name: 'Bottle' },
        usedBy: 'bottles',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/origins',
        handlers: originHandlers,
        used: { id: 'shop', name: 'Shop' },
        usedBy: 'bottles',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/countries',
        handlers: countryHandlers,
        used: { id: 'fr', name: 'France' },
        usedBy: 'regions',
        duplicate: 'duplicate_name'
    },
    {
        path: '/api/regions',
        handlers: regionHandlers,
        used: { id: 'bdx', name: 'Bordeaux' },
        usedBy: 'appellations',
        duplicate: 'duplicate_region',
        parent: { countryId: 'fr' }
    },
    {
        path: '/api/appellations',
        handlers: appellationHandlers,
        used: { id: 'mgx', name: 'Margaux' },
        usedBy: 'wine_definitions',
        duplicate: 'duplicate_appellation',
        parent: { regionId: 'bdx' }
    }
] satisfies {
    path: string;
    handlers: Handlers;
    used: { id: string; name: string };
    usedBy: string;
    duplicate: string;
    parent?: Record<string, string>;
}[];

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

beforeAll(async () => {
    const margaux = await insertWineDefinition();
    const now = new Date();
    await db
        .insert(wineClassifications)
        .values({ id: 'gc', name: 'Grand Cru', createdAt: now, updatedAt: now });
    await db
        .update(wineDefinitions)
        .set({ classificationId: 'gc' })
        .where(eq(wineDefinitions.id, margaux));
    await db.insert(origins).values({ id: 'shop', name: 'Shop', createdAt: now });
    createBottles(bottleData(margaux, { originId: 'shop' }), 1);
});

describe.each(TABLES)('$path', ({ path, handlers, used, usedBy, duplicate, ...table }) => {
    const parent = 'parent' in table ? table.parent : {};
    const post = (name: unknown) =>
        send(handlers, { method: 'POST', path, body: { name, ...parent } });
    const put = (id: string, name: string) =>
        send(handlers, { method: 'PUT', path, id, body: { name, ...parent } });
    const remove = (id: string) => send(handlers, { method: 'DELETE', path, id });

    it('creates a row with its name trimmed, then answers 200 with it for the name again', async () => {
        const created = await post(' Zeta ');
        const again = await post('Zeta');

        expect(created).toMatchObject({ status: 201, body: { name: 'Zeta', ...parent } });
        expect(again).toEqual({ status: 200, body: created.body });
    });

    it('answers 200 with the row of the same name in another case, accents included', async () => {
        const created = await post('Élan');
        const again = await post(' éLAN ');

        expect(again).toEqual({ status: 200, body: created.body });
        expect(names((await send(handlers, { path })).body)).not.toContain('éLAN');
    });

    it('lists its rows by name', async () => {
        await post('Alpha');
        const { status, body } = await send(handlers, { path });

        expect(status).toBe(200);
        expect(names(body)).toEqual([...names(body)].sort());
        expect(names(body)).toEqual(expect.arrayContaining(['Alpha', used.name]));
    });

    it('renames a row and answers it', async () => {
        const { body: row } = await post('Beta');
        const { status, body } = await put(row.id, ' Gamma ');

        expect(status).toBe(200);
        expect(body).toMatchObject({ id: row.id, name: 'Gamma', ...parent });
    });

    it('answers 409 to a name that another row has', async () => {
        const { body: row } = await post('Delta');
        const { status, body } = await put(row.id, used.name);

        expect(status).toBe(409);
        expect(body.error.code).toBe(duplicate);
    });

    // As POST finds the row of that name whatever its case (API-03): no second « france ».
    it('answers 409 to a name that another row has in another case, accents included', async () => {
        const { body: row } = await post('Iota');
        await post('Ïsland');

        for (const name of [used.name.toUpperCase(), ' ïSLAND ']) {
            const { status, body } = await put(row.id, name);

            expect(status).toBe(409);
            expect(body.error.code).toBe(duplicate);
        }
        expect(names((await send(handlers, { path })).body)).toContain('Iota');
    });

    it('renames a row to its own name in another case', async () => {
        const { body: row } = await post('kappa');
        const { status, body } = await put(row.id, 'Kappa');

        expect(status).toBe(200);
        expect(body).toMatchObject({ id: row.id, name: 'Kappa', ...parent });
    });

    it('answers 404 to an id that no row has', async () => {
        const missing = [
            await put('nowhere', 'Ghost'),
            await put('nowhere', used.name.toUpperCase()),
            await remove('nowhere')
        ];
        for (const response of missing) {
            expect(response).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } });
        }
    });

    it('refuses with 409 to delete a row in use, says by how many, and keeps it', async () => {
        const { status, body } = await remove(used.id);

        expect(status).toBe(409);
        expect(body.error).toMatchObject({ code: 'in_use', details: { count: 1, usedBy } });
        expect(names((await send(handlers, { path })).body)).toContain(used.name);
    });

    it('deletes a row that nothing uses', async () => {
        const { body: row } = await post('Epsilon');

        expect((await remove(row.id)).status).toBe(204);
        expect(names((await send(handlers, { path })).body)).not.toContain('Epsilon');
    });

    it('serves reads to anyone and writes only with a session', () => {
        const needsSession = (method: string, routeId: string) =>
            requiresSession(fakeEvent({ method, routeId }));

        expect(needsSession('GET', path)).toBe(false);
        expect(needsSession('POST', path)).toBe(true);
        expect(needsSession('PUT', `${path}/[id]`)).toBe(true);
        expect(needsSession('DELETE', `${path}/[id]`)).toBe(true);
    });
});

describe('the name of a row', () => {
    const post = (body: unknown) =>
        send(wineTypeHandlers, { method: 'POST', path: '/api/wine-types', body });

    it('is `name` in the API, whatever the column is called', async () => {
        const { body } = await post({ name: 'Sparkling' });

        expect(body).toMatchObject({ name: 'Sparkling' });
        expect(body).not.toHaveProperty('type');
    });

    it.each([
        ['an empty name', { name: '  ' }],
        ['a name that is not text', { name: 42 }],
        ['the name of the column', { type: 'Fortified' }]
    ])('answers 422 to %s', async (_, body) => {
        expect((await post(body)).status).toBe(422);
    });
});

describe('a row with a parent', () => {
    const regions = (request: Omit<Request, 'path'>) =>
        send(regionHandlers, { path: '/api/regions', ...request });

    beforeAll(async () => {
        await send(countryHandlers, {
            method: 'POST',
            path: '/api/countries',
            body: { name: 'Italy' }
        });
    });

    const italy = async () =>
        (await send(countryHandlers, { path: '/api/countries' })).body.find(
            (country: { name: string }) => country.name === 'Italy'
        ).id;

    it('takes a name that a row of another parent has', async () => {
        const { status, body } = await regions({
            method: 'POST',
            body: { name: 'Bordeaux', countryId: await italy() }
        });

        expect(status).toBe(201);
        expect(body).toMatchObject({ name: 'Bordeaux', countryName: 'Italy' });
    });

    it('answers 409 to a parent that does not exist', async () => {
        const created = await regions({
            method: 'POST',
            body: { name: 'Atlantis', countryId: 'nowhere' }
        });
        const moved = await regions({
            method: 'PUT',
            id: 'bdx',
            body: { name: 'Bordeaux', countryId: 'nowhere' }
        });

        for (const response of [created, moved]) {
            expect(response).toMatchObject({
                status: 409,
                body: { error: { code: 'missing_reference' } }
            });
        }
    });

    it('lists only the rows of the parent asked for', async () => {
        const { body } = await send(regionHandlers, {
            path: `/api/regions?countryId=${await italy()}`
        });

        expect(names(body)).toEqual(['Bordeaux']);
        expect(body[0]).toMatchObject({ countryName: 'Italy' });
    });

    it('comes with the names of its region and country', async () => {
        const { body } = await send(appellationHandlers, {
            path: '/api/appellations?regionId=bdx'
        });

        expect(body).toContainEqual(
            expect.objectContaining({
                id: 'mgx',
                regionId: 'bdx',
                regionName: 'Bordeaux',
                countryId: 'fr',
                countryName: 'France'
            })
        );
    });

    it('moves to another parent, and answers with its new names', async () => {
        const { body: row } = await regions({
            method: 'POST',
            body: { name: 'Jura', countryId: 'fr' }
        });
        const { status, body } = await regions({
            method: 'PUT',
            id: row.id,
            body: { name: 'Jura', countryId: await italy() }
        });

        expect(status).toBe(200);
        expect(body).toMatchObject({ id: row.id, countryName: 'Italy' });
    });

    it('compares the name with those of its new parent only, whatever their case', async () => {
        const { body: spain } = await send(countryHandlers, {
            method: 'POST',
            path: '/api/countries',
            body: { name: 'Spain' }
        });
        const { body: row } = await regions({
            method: 'POST',
            body: { name: 'Rioja', countryId: 'fr' }
        });
        const rename = async (countryId: string) =>
            regions({ method: 'PUT', id: row.id, body: { name: 'bordeaux', countryId } });

        expect(await rename('fr')).toMatchObject({
            status: 409,
            body: { error: { code: 'duplicate_region' } }
        });
        expect(await rename(spain.id)).toMatchObject({
            status: 200,
            body: { name: 'bordeaux', countryName: 'Spain' }
        });
    });
});

describe('the colour of a wine colour', () => {
    const path = '/api/wine-colors';
    const create = (body: object) => send(wineColorHandlers, { method: 'POST', path, body });

    it('starts with the colour of its name, or grey for a name the app does not know', async () => {
        expect((await create({ name: 'Rosé' })).body.hex).toBe(startingHex('Rosé'));
        expect((await create({ name: 'Orange' })).body.hex).toBe(NEUTRAL_HEX);
    });

    it('takes the colour of the body, in lower case', async () => {
        const { status, body } = await create({ name: 'Gris', hex: '#C0FFEE' });
        expect(status).toBe(201);
        expect(body).toMatchObject({ name: 'Gris', hex: '#c0ffee' });
    });

    it('refuses a colour that is not #rrggbb with 422', async () => {
        for (const hex of ['red', '#fff', '#12345g', '#1234567', '']) {
            const { status, body } = await create({ name: `Bad ${hex}`, hex });
            expect(status).toBe(422);
            expect(body.error.details[0].path).toBe('hex');
        }
    });

    it('keeps its colour when renamed without one, and takes a new one', async () => {
        const { body: created } = await create({ name: 'Paille', hex: '#e6c86e' });
        const rename = (body: object) =>
            send(wineColorHandlers, { method: 'PUT', path, id: created.id, body });

        expect((await rename({ name: 'Vin de paille' })).body.hex).toBe('#e6c86e');
        expect((await rename({ name: 'Vin de paille', hex: '#aa7733' })).body.hex).toBe('#aa7733');
    });
});

describe('deleting a row that starts to be used meanwhile', () => {
    it('is refused by the foreign key: 409 in_use, not 500, and the row is kept', async () => {
        // A wine created with this type while it is deleted: SQLite runs the trigger in the
        // statement of the deletion, after any check that the route could have made before.
        // The trigger's wine goes with the refused statement, so no count is asserted.
        const { body: type } = await send(wineTypeHandlers, {
            method: 'POST',
            path: '/api/wine-types',
            body: { name: 'Orange' }
        });
        db.$client.exec(
            `CREATE TEMP TRIGGER use_while_deleting BEFORE DELETE ON main.wine_types
             BEGIN
                 INSERT INTO wine_definitions (id, name, appellation_id, type_id, color_id,
                     created_at, updated_at)
                 VALUES ('late', 'Late wine', 'mgx', OLD.id, 'red', 0, 0);
             END`
        );
        onTestFinished(() => {
            db.$client.exec('DROP TRIGGER temp.use_while_deleting');
        });

        const { status, body } = await send(wineTypeHandlers, {
            method: 'DELETE',
            path: '/api/wine-types',
            id: type.id
        });

        expect(status).toBe(409);
        expect(body.error.code).toBe('in_use');
        expect(names((await send(wineTypeHandlers, { path: '/api/wine-types' })).body)).toContain(
            'Orange'
        );
    });
});
