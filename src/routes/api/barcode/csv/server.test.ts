import { beforeAll, describe, expect, it } from 'vitest';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { fakeEvent } from '../../../../test/event';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { POST } from './+server';

type Event = Parameters<typeof POST>[0];

const exportCsv = (body: unknown) =>
    POST(
        fakeEvent<Event>({
            method: 'POST',
            path: '/api/barcode/csv',
            routeId: '/api/barcode/csv',
            body
        })
    );

describe('POST /api/barcode/csv', () => {
    beforeAll(async () => {
        const definitionId = await insertWineDefinition();
        setAppSetting('barcode_auto_generation', 'true');
        setAppSetting('barcode_prefix', 'CV');
        setAppSetting('barcode_start_number', '1');
        createBottles(bottleData(definitionId, { vintage: 2015 }), 2);
    });

    it('fills in the bottles that already have a code of the range', async () => {
        const response = await exportCsv({ startNumber: 1, count: 3 });

        expect(response.status).toBe(200);
        expect((await response.text()).trim().split('\n')).toEqual([
            'barcode,wine_name,producer,appellation,vintage,wine_type,color,location',
            'CV00000001,Château Margaux,,Margaux,2015,Still,Red,',
            'CV00000002,Château Margaux,,Margaux,2015,Still,Red,',
            'CV00000003,,,,,,,'
        ]);
    });

    it.each([
        { startNumber: '5', count: 2 },
        { startNumber: 1.5, count: 2 },
        { startNumber: 1, count: '2' }
    ])('answers 422 to the range %j', async (range) => {
        expect((await exportCsv(range)).status).toBe(422);
    });

    it('refuses a range past the last number of the prefix', async () => {
        const response = await exportCsv({ startNumber: 99_999_999, count: 2 });

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'barcode_out_of_range',
            details: { min: 1, max: 99999999 }
        });
    });

    it.each([
        ['an invalid prefix', { prefix: 'C/V' }, 'invalid_barcode_prefix'],
        ['no prefix', {}, 'barcode_prefix_required']
    ])('answers 422 to %s while automatic barcodes are off', async (_, prefix, code) => {
        setAppSetting('barcode_auto_generation', 'false');
        try {
            const response = await exportCsv({ startNumber: 1, count: 2, ...prefix });

            expect(response.status).toBe(422);
            expect((await response.json()).error.code).toBe(code);
        } finally {
            setAppSetting('barcode_auto_generation', 'true');
        }
    });
});
