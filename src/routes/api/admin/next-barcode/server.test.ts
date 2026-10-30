import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { GET } from './+server';

const nextBarcode = () =>
    GET(fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/next-barcode' }));

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
});

beforeEach(() => {
    setAppSetting('barcode_auto_generation', 'true');
    setAppSetting('barcode_prefix', 'CV');
    setAppSetting('barcode_start_number', '1');
});

describe('GET /api/admin/next-barcode', () => {
    it('gives the code that the next bottle will get, without taking it', async () => {
        createBottles(bottleData(definitionId), 2);

        const response = await nextBarcode();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            barcode: 'CV00000003',
            nextNumber: 3,
            prefix: 'CV'
        });
        expect((await (await nextBarcode()).json()).barcode).toBe('CV00000003');
    });

    it('answers 409 barcode_generation_off while automatic barcodes are off', async () => {
        setAppSetting('barcode_auto_generation', 'false');

        const response = await nextBarcode();

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('barcode_generation_off');
    });

    it('answers 409 barcode_prefix_too_long to a prefix of 7 characters or more', async () => {
        // A prefix saved before prefixes were validated.
        setAppSetting('barcode_prefix', 'OLDWINES');

        const response = await nextBarcode();

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('barcode_prefix_too_long');
    });

    it('answers 409 barcode_range once the prefix has no number left', async () => {
        setAppSetting('barcode_prefix', 'CELLAR');
        setAppSetting('barcode_start_number', '9999');
        createBottles(bottleData(definitionId), 1);

        const response = await nextBarcode();

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('barcode_range');
    });
});
