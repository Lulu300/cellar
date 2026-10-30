import { describe, expect, it } from 'vitest';
import {
    barcodedBottles,
    computeRows,
    findBarcodeMatches,
    findSameBarcode,
    searchBarcode,
    type BulkBottle,
    type Line
} from './bulk-barcode';

const bottle = (fields: Partial<BulkBottle> = {}): BulkBottle => ({
    id: 'b1',
    availability: 'available',
    storageCaseId: 'case-a',
    ...fields
});

/** A line whose code found `checked`, the bottle as it was when the code was checked. */
const line = (checked: BulkBottle): Line<BulkBottle> => ({
    code: '0001',
    matches: [checked],
    chosenId: checked.id,
    included: true
});

const byId = (...bottles: BulkBottle[]) => new Map(bottles.map((b) => [b.id, b]));

describe('computeRows', () => {
    it('does not change again a bottle that already has the target status since a reload', () => {
        const checked = bottle();
        const reloaded = bottle({ availability: 'consumed', storageCaseId: null });

        const [row] = computeRows([line(checked)], byId(reloaded), 'consumed', '');

        expect(row.willChange).toBe(false);
        expect(row.bottle).toBe(reloaded);
    });

    it('compares the target case with the case the bottle has since a reload', () => {
        const checked = bottle({ storageCaseId: 'case-a' });

        expect(
            computeRows([line(checked)], byId(bottle({ storageCaseId: 'case-b' })), '', 'case-b')
        ).toMatchObject([{ willChange: false }]);
        expect(
            computeRows([line(checked)], byId(bottle({ storageCaseId: 'case-b' })), '', 'case-a')
        ).toMatchObject([{ willChange: true }]);
    });

    it('keeps the bottle read when checking when the reload no longer has it', () => {
        const checked = bottle();

        expect(computeRows([line(checked)], byId(), 'consumed', '')).toMatchObject([
            { state: 'found', bottle: checked, willChange: true }
        ]);
    });
});

describe('findBarcodeMatches', () => {
    const coded = (...barcodes: string[]) =>
        barcodes.map((barcode, i) => ({ id: `b${i}`, barcode }));

    it('finds the one bottle with the code as typed when another differs by its case only', () => {
        const bottles = coded('CV00000001', 'cv00000001');

        expect(findBarcodeMatches(bottles, 'CV00000001')).toEqual([bottles[0]]);
        expect(findBarcodeMatches(bottles, 'cv00000001')).toEqual([bottles[1]]);
    });

    it('then finds the code in other capitals, then the codes that end with it', () => {
        const bottles = coded('CV00000001', 'XX00000012', 'CV00000012');

        expect(findBarcodeMatches(bottles, 'cv00000001')).toEqual([bottles[0]]);
        expect(findBarcodeMatches(bottles, '012')).toEqual([bottles[1], bottles[2]]);
        expect(findBarcodeMatches(bottles, 'Cv00000003')).toEqual([]);
    });
});

describe('findSameBarcode', () => {
    it('skips the bottles without a barcode', () => {
        const bottles = [
            { id: 'b0', barcode: null },
            { id: 'b1', barcode: 'CV00000001' }
        ];

        expect(findSameBarcode(bottles, 'cv00000001')).toEqual([bottles[1]]);
    });
});

describe('searchBarcode', () => {
    const coded = (...barcodes: string[]) =>
        barcodes.map((barcode, i) => ({ id: `b${i}`, barcode }));

    it('finds the code as typed, then in other capitals, then the codes that contain it', () => {
        const bottles = coded('CV0001', 'CV00012', 'XCV0001Z', 'cv0001');

        expect(searchBarcode(bottles, 'CV0001')).toEqual([bottles[0]]);
        expect(searchBarcode(bottles, 'Cv00012')).toEqual([bottles[1]]);
        expect(searchBarcode(bottles, 'V000')).toEqual(bottles);
        expect(searchBarcode(bottles, 'nothing')).toEqual([]);
    });
});

describe('barcodedBottles', () => {
    it('gives each bottle with a barcode its wine', () => {
        const wines = [
            {
                definition: { id: 'w1' },
                bottles: [
                    { id: 'b1', barcode: 'CV1' },
                    { id: 'b2', barcode: null }
                ]
            },
            { definition: { id: 'w2' }, bottles: [{ id: 'b3', barcode: 'CV3' }] }
        ];

        expect(barcodedBottles(wines)).toEqual([
            { id: 'b1', barcode: 'CV1', definition: { id: 'w1' } },
            { id: 'b3', barcode: 'CV3', definition: { id: 'w2' } }
        ]);
    });
});
