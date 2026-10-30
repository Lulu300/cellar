import { beforeEach, describe, expect, it } from 'vitest';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { fakeEvent } from '../../../../test/event';
import { GET as exportAll } from './+server';
import { GET as exportManual } from '../export-manual/+server';

// Each route reads nothing of its event but the request.
const answer = async (handler: (event: never) => Response | Promise<Response>, path: string) => {
    const response = await handler(fakeEvent<never>({ path }));
    return { status: response.status, code: (await response.json()).error?.code };
};

describe('barcode exports of an empty cellar', () => {
    beforeEach(() => setAppSetting('barcode_auto_generation', 'true'));

    it('answer 409 nothing_to_export, which the barcode page translates', async () => {
        const expected = { status: 409, code: 'nothing_to_export' };

        expect(await answer(exportAll, '/api/barcode/export-all')).toEqual(expected);
        expect(await answer(exportManual, '/api/barcode/export-manual')).toEqual(expected);
    });

    it('answer 409 to the export of generated codes while generation is off', async () => {
        setAppSetting('barcode_auto_generation', 'false');

        expect(await answer(exportAll, '/api/barcode/export-all')).toEqual({
            status: 409,
            code: 'barcode_generation_off'
        });
    });
});
