import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineTypes } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { insertWineDefinition } from '../../../test/wine';
import { GET, POST } from './+server';

const post = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/definitions',
            routeId: '/api/definitions',
            body
        })
    );

// A still red wine of the appellation mgx
const wine = { name: 'Pavillon Rouge', appellationId: 'mgx', typeId: 'still', colorId: 'red' };

// Margaux, a still red wine of the appellation mgx.
beforeAll(() => insertWineDefinition());

describe('POST /api/definitions', () => {
    it('creates the wine from ids', async () => {
        const response = await post({ ...wine, classificationId: '', rating: 4.5 });

        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({
            ...wine,
            classificationId: null,
            rating: 4.5
        });
    });

    // An emoji is two UTF-16 units: 2,499 emoji and two letters fill the 5,000 (API-12).
    it('creates a wine whose description has 5,000 UTF-16 units with emoji', async () => {
        const description = '🍷'.repeat(2_499) + 'ab';

        const response = await post({ ...wine, name: 'Emoji', description });

        expect(response.status).toBe(201);
        expect((await response.json()).description).toBe(description);
    });

    // A name counts UTF-16 units too, as the forms and the imports count it (API-13).
    it.each([
        ['a name of 250 emoji', { name: '🍷'.repeat(250) }],
        ['a name of a letter and 249 emoji', { name: `a${'🍷'.repeat(249)}` }],
        ['a producer of 250 emoji', { producer: '🍷'.repeat(250) }]
    ])('creates a wine with %s, 500 UTF-16 units at most', async (_, fields) => {
        const response = await post({ ...wine, ...fields });

        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject(fields);
    });

    it.each([
        ['a name of 250 emoji and a letter', { name: `${'🍷'.repeat(250)}a` }],
        ['a producer of 250 emoji and a letter', { producer: `${'🍷'.repeat(250)}a` }],
        ['a rating out of 1 to 5', { rating: 7 }],
        ['no appellation', { appellationId: undefined }],
        ['a type given by name', { typeId: undefined, type: 'Sparkling' }],
        ['a website that is not http(s)', { website: 'javascript:alert(1)' }],
        ['a description of more than 5,000 characters', { description: 'x'.repeat(5_001) }],
        // An emoji is two UTF-16 units, as the forms and the imports count it (API-12).
        ['a description of 2,500 emoji and a letter', { description: '🍷'.repeat(2_500) + 'x' }]
    ])('answers 422 for %s, and creates nothing', async (_, fields) => {
        const before = await db.select().from(wineDefinitions);
        const typesBefore = await db.select().from(wineTypes);

        const response = await post({ ...wine, ...fields });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_body');
        expect(await db.select().from(wineDefinitions)).toEqual(before);
        expect(await db.select().from(wineTypes)).toEqual(typesBefore);
    });

    it('answers 409 for a type id that does not exist, and creates no type', async () => {
        const typesBefore = await db.select().from(wineTypes);

        const response = await post({ ...wine, typeId: 'Sparkling' });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'missing_reference',
            details: [{ field: 'typeId', id: 'Sparkling' }]
        });
        expect(await db.select().from(wineTypes)).toEqual(typesBefore);
    });
});

describe('GET /api/definitions', () => {
    // It named every wine's place "Unknown Region" and "Unknown Appellation" before 0.7.0.
    it('names the appellation, region and country of each wine', async () => {
        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({
                path: '/api/definitions',
                routeId: '/api/definitions'
            })
        );

        expect(await response.json()).toContainEqual(
            expect.objectContaining({
                id: 'margaux',
                appellationName: 'Margaux',
                region: 'Bordeaux',
                country: 'France'
            })
        );
    });
});
