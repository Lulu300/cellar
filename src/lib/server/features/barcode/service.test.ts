import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { appSettings, wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { failWrites } from '../../../../test/failing-write';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { getBarcodeSettings } from './repository';
import {
    barcodeStats,
    exportBarcodeRange,
    exportBarcodes,
    labelPrefix,
    updateBarcodeSettings
} from './service';

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
});

beforeEach(() => {
    db.delete(wineBottles).run();
    db.delete(appSettings).run();
});

describe('updateBarcodeSettings', () => {
    it('saves the three settings', () => {
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 10 });

        expect(getBarcodeSettings()).toEqual({
            autoGeneration: true,
            prefix: 'CV',
            startNumber: 10
        });
    });

    it('saves all three or none', () => {
        updateBarcodeSettings({ autoGeneration: false, prefix: 'OLD', startNumber: 1 });
        failWrites('UPDATE', 'app_settings', "NEW.key = 'barcode_start_number'");

        expect(() =>
            updateBarcodeSettings({ autoGeneration: true, prefix: 'NEW', startNumber: 5 })
        ).toThrow();
        expect(getBarcodeSettings()).toEqual({
            autoGeneration: false,
            prefix: 'OLD',
            startNumber: 1
        });
    });

    it('tells when the sequence goes on past the start requested', () => {
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 1 });
        createBottles(bottleData(definitionId), 3);

        expect(
            updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 2 })
        ).toEqual({
            hasConflict: true,
            requestedStart: 2,
            actualNext: 4,
            nextBarcode: 'CV00000004'
        });
    });

    it('refuses an invalid prefix or a start past its last number, saving nothing', () => {
        expect(() =>
            updateBarcodeSettings({ autoGeneration: true, prefix: 'TOO-LONG', startNumber: 1 })
        ).toThrow(expect.objectContaining({ status: 422, code: 'invalid_barcode_prefix' }));
        expect(() =>
            updateBarcodeSettings({ autoGeneration: true, prefix: 'CELLAR', startNumber: 10_000 })
        ).toThrow(expect.objectContaining({ status: 422, code: 'barcode_out_of_range' }));
        expect(db.select().from(appSettings).all()).toEqual([]);
    });
});

describe('labelPrefix', () => {
    it('takes the configured prefix with automatic barcodes, the requested one otherwise', () => {
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 1 });
        expect(labelPrefix('XX')).toBe('CV');

        updateBarcodeSettings({ autoGeneration: false, prefix: 'CV', startNumber: 1 });
        expect(labelPrefix('XX')).toBe('XX');
        expect(() => labelPrefix('')).toThrow(
            expect.objectContaining({ code: 'barcode_prefix_required' })
        );
    });
});

describe('the codes of the configured prefix', () => {
    /** The barcodes that the export of the prefix lists. */
    const exported = () =>
        exportBarcodes()
            .csv.trim()
            .split('\n')
            .slice(1)
            .map((line) => line.split(',')[0]);

    it('count and export only the generated codes of the prefix, capitals included', () => {
        updateBarcodeSettings({ autoGeneration: false, prefix: '', startNumber: 1 });
        for (const barcode of [
            'CV00000001',
            'cv00000002',
            'CVABCD0001',
            'CVX0000001',
            'CV-manual',
            'CV000000000003'
        ]) {
            createBottles(bottleData(definitionId, { barcode }), 1);
        }
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 1 });

        expect(barcodeStats().totalWithBarcode).toBe(1);
        expect(exported()).toEqual(['CV00000001']);
    });

    it('with an empty prefix, count only the codes of 10 digits, those of digit prefixes included', () => {
        updateBarcodeSettings({ autoGeneration: false, prefix: '', startNumber: 1 });
        for (const barcode of ['ABC-1', '1230000002', '12345', 'CV00000001']) {
            createBottles(bottleData(definitionId, { barcode }), 1);
        }
        updateBarcodeSettings({ autoGeneration: true, prefix: '', startNumber: 1 });

        expect(barcodeStats().totalWithBarcode).toBe(1);
        expect(exported()).toEqual(['1230000002']);
    });

    it('count the 13-character codes generated before September 2025', () => {
        updateBarcodeSettings({ autoGeneration: false, prefix: '', startNumber: 1 });
        for (const barcode of ['CV00000000012', 'CV00000001']) {
            createBottles(bottleData(definitionId, { barcode }), 1);
        }
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 1 });

        expect(barcodeStats().totalWithBarcode).toBe(2);
        expect(exported()).toEqual(['CV00000000012', 'CV00000001']);
    });
});

describe('exportBarcodeRange', () => {
    it('lists each code, with the wine of the bottle that has it', () => {
        updateBarcodeSettings({ autoGeneration: true, prefix: 'CV', startNumber: 1 });
        createBottles(bottleData(definitionId, { vintage: 2015 }), 1);

        const { filename, csv } = exportBarcodeRange(1, 2, null);

        expect(filename).toMatch(/^barcodes_CV_1_2_\d+\.csv$/);
        expect(csv).toBe(
            'barcode,wine_name,producer,appellation,vintage,wine_type,color,location\n' +
                'CV00000001,Château Margaux,,Margaux,2015,Still,Red,\n' +
                'CV00000002,,,,,,,\n'
        );
    });

    // FEAT-12: a drunk bottle keeps the case it was in, which is not where it is.
    it('names the case of a bottle still owned, not the one a drunk bottle left', () => {
        updateBarcodeSettings({ autoGeneration: false, prefix: 'CV', startNumber: 1 });
        const caseId = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [6] }).cases[0]
            .id;
        for (const [barcode, availability] of [
            ['CV00000001', 'available'],
            ['CV00000002', 'out_of_cellar'],
            ['CV00000003', 'consumed']
        ]) {
            createBottles(
                bottleData(definitionId, { barcode, availability, storageCaseId: caseId }),
                1
            );
        }

        const lines = exportBarcodeRange(1, 3, 'CV').csv.trim().split('\n').slice(1);

        expect(lines.map((line) => line.split(',').at(-1))).toEqual(['Rack1', 'Rack1', '']);
    });

    it('guards a name that a spreadsheet would run, but not a code of the prefix -AB', () => {
        updateBarcodeSettings({ autoGeneration: true, prefix: '-AB', startNumber: 1 });
        const rename = (name: string) =>
            db
                .update(wineDefinitions)
                .set({ name })
                .where(eq(wineDefinitions.id, definitionId))
                .run();
        rename('=1+1');
        try {
            createBottles(bottleData(definitionId), 1);

            const [, line] = exportBarcodeRange(1, 1, null).csv.split('\n');

            expect(line).toBe(`-AB0000001,"'=1+1",,Margaux,,Still,Red,`);
        } finally {
            rename('Château Margaux');
        }
    });
});
