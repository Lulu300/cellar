import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../test/event';
import { insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

describe('GET /api/admin/wine-definitions', () => {
    it('lists each wine with the names of its appellation, region, country, type and colour', async () => {
        const id = await insertWineDefinition();
        await db
            .update(wineDefinitions)
            .set({ producer: 'Margaux SA', rating: 5, grapeVarieties: ['Merlot'] })
            .where(eq(wineDefinitions.id, id));

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/wine-definitions' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
            expect.objectContaining({
                id,
                name: 'Château Margaux',
                producer: 'Margaux SA',
                appellationName: 'Margaux',
                regionName: 'Bordeaux',
                countryName: 'France',
                classificationId: null,
                classificationName: null,
                typeName: 'Still',
                colorName: 'Red',
                rating: 5,
                grapeVarieties: ['Merlot'],
                imageId: null
            })
        ]);
    });
});
