import { beforeAll, describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { fakeEvent } from '../../../../test/event';
import { GET } from './+server';
import { GET as manualStats } from '../stats-manual/+server';

beforeAll(async () => {
    const definitionId = await insertWineDefinition();
    setAppSetting('barcode_auto_generation', 'false');
    for (const barcode of ['0000000005', '0000000002']) {
        createBottles(bottleData(definitionId, { barcode }), 1);
    }
    setAppSetting('barcode_auto_generation', 'true');
});

describe('GET /api/barcode/stats', () => {
    it('gives the number that the next bottle will get', async () => {
        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/barcode/stats' })
        );

        expect(await response.json()).toEqual({ totalWithBarcode: 2, nextNumber: 6, prefix: '' });
    });
});

describe('GET /api/barcode/stats-manual', () => {
    it('counts every bottle with a barcode, whatever the configured prefix', async () => {
        setAppSetting('barcode_prefix', 'CV');
        try {
            const response = await manualStats(
                fakeEvent<Parameters<typeof manualStats>[0]>({ path: '/api/barcode/stats-manual' })
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ totalWithBarcode: 2 });
        } finally {
            setAppSetting('barcode_prefix', '');
        }
    });
});
