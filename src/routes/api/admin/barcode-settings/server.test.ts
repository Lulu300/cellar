import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { getBarcodeSettings } from '#lib/server/features/barcode/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { GET, PUT } from './+server';

type Event = Parameters<typeof PUT>[0];

const put = (body: unknown) =>
    PUT(
        fakeEvent<Event>({
            method: 'PUT',
            path: '/api/admin/barcode-settings',
            routeId: '/api/admin/barcode-settings',
            body
        })
    );

describe('PUT /api/admin/barcode-settings', () => {
    beforeAll(async () => {
        const definitionId = await insertWineDefinition();
        for (const barcode of ['CELLAR9999', 'WINE000007']) {
            createBottles(bottleData(definitionId, { barcode }), 1);
        }
    });

    beforeEach(async () => {
        setAppSetting('barcode_auto_generation', 'false');
        setAppSetting('barcode_prefix', 'CV');
        setAppSetting('barcode_start_number', '1');
    });

    it('checks the next number with the start number being saved', async () => {
        setAppSetting('barcode_start_number', '50000');

        const response = await put({ autoGeneration: true, prefix: 'NEW', startNumber: 1 });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            autoGeneration: true,
            prefix: 'NEW',
            startNumber: 1,
            conflictInfo: {
                hasConflict: false,
                requestedStart: 1,
                actualNext: 1,
                nextBarcode: 'NEW0000001'
            }
        });
    });

    it('reports the codes already used from the requested start number', async () => {
        const response = await put({ autoGeneration: true, prefix: 'WINE', startNumber: 3 });

        expect((await response.json()).conflictInfo).toEqual({
            hasConflict: true,
            requestedStart: 3,
            actualNext: 8,
            nextBarcode: 'WINE000008'
        });
    });

    it('refuses a start number past the last number of the prefix', async () => {
        const response = await put({ autoGeneration: true, prefix: 'CELLAR', startNumber: 10_000 });

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'barcode_out_of_range',
            details: { min: 1, max: 9999 }
        });
        expect(await getBarcodeSettings()).toEqual({
            autoGeneration: false,
            prefix: 'CV',
            startNumber: 1
        });
    });

    it('refuses a prefix with no number left, without saving any setting', async () => {
        const response = await put({ autoGeneration: true, prefix: 'CELLAR', startNumber: 1 });

        expect(response.status).toBe(409);
        expect((await response.json()).error.message).toMatch(/numbers go from 1 to 9999/);
        expect(await getBarcodeSettings()).toEqual({
            autoGeneration: false,
            prefix: 'CV',
            startNumber: 1
        });
    });

    it('answers 422 invalid_barcode_prefix to a prefix with other characters', async () => {
        const response = await put({ autoGeneration: true, prefix: 'C/V', startNumber: 1 });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_barcode_prefix');
    });
});

describe('GET /api/admin/barcode-settings', () => {
    it('gives the saved settings', async () => {
        setAppSetting('barcode_auto_generation', 'true');
        setAppSetting('barcode_prefix', 'CV');
        setAppSetting('barcode_start_number', '100');

        const response = await GET(fakeEvent<Event>({ path: '/api/admin/barcode-settings' }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            autoGeneration: true,
            prefix: 'CV',
            startNumber: 100
        });
    });
});
