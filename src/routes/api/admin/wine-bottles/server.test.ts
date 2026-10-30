import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

describe('GET /api/admin/wine-bottles', () => {
    it('lists every bottle, newest first, with the names of its wine and format', async () => {
        const definitionId = await insertWineDefinition();
        await insertBottles(definitionId, [
            { id: 'old', createdAt: new Date('2026-01-01'), vintage: 2015, barcode: 'CEL-1' },
            { id: 'new', createdAt: new Date('2026-02-01'), availability: 'consumed' }
        ]);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/wine-bottles' })
        );

        expect(response.status).toBe(200);
        const bottles = await response.json();
        expect(bottles.map((row: { id: string }) => row.id)).toEqual(['new', 'old']);
        expect(bottles[1]).toMatchObject({
            definitionId,
            wineName: 'Château Margaux',
            appellationName: 'Margaux',
            countryName: 'France',
            typeName: 'Still',
            colorName: 'Red',
            formatName: 'Bottle',
            vintage: 2015,
            barcode: 'CEL-1',
            availability: 'available',
            originName: null,
            storageCaseName: null,
            createdAt: '2026-01-01T00:00:00.000Z'
        });
        expect(bottles[0].availability).toBe('consumed');
    });
});
