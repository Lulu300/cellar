import { describe, expect, it } from 'vitest';
import { barcodedBottles, computeRows, type BulkBottle, type Line } from './bulk-barcode';

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
