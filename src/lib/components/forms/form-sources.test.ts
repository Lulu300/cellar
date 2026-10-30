import { describe, expect, it } from 'vitest';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { useLocale } from '../../../test/locale';
import { bottleFormValues, dropUnchanged, type BottleFormSource } from './form-sources';

const bottle: BottleFormSource = {
    id: 'b1',
    definitionId: 'margaux',
    originId: null,
    formatId: 'bottle',
    vintage: 2015,
    optimum: null,
    purchasePrice: 12.5,
    // Stored with a time, which the form cannot show
    purchaseDate: new Date('2025-03-01T18:30:00Z'),
    currentValue: null,
    currentValueDate: null,
    storageCaseId: 'a1',
    notes: null,
    barcode: 'CELLAR0001',
    availability: BottleAvailability.CONSUMED,
    consumedDate: '2026-01-02T00:00:00.000Z'
};

describe('bottleFormValues', () => {
    it('gives the fields of a bottle as the form holds them', () => {
        expect(bottleFormValues(bottle)).toMatchObject({
            vintage: '2015',
            optimum: '',
            purchasePrice: '12.5',
            purchaseDate: '2025-03-01',
            consumedDate: '2026-01-02',
            barcode: 'CELLAR0001'
        });
    });

    // Found after BUG-14: the text fields showed "12.5" in French, where a French browser had
    // shown "12,5".
    it('shows the numbers in the language of the interface', () => {
        useLocale('fr');
        expect(bottleFormValues({ ...bottle, currentValue: 1234.75 })).toMatchObject({
            vintage: '2015',
            purchasePrice: '12,5',
            currentValue: '1234,75'
        });
    });

    it('makes a copy a new bottle in the cellar, without the barcode of the original', () => {
        expect(bottleFormValues(bottle, { copy: true })).toMatchObject({
            vintage: '2015',
            barcode: '',
            availability: BottleAvailability.AVAILABLE,
            consumedDate: ''
        });
    });

    it('starts a new bottle with the wine chosen beforehand', () => {
        expect(bottleFormValues(null, { definitionId: 'margaux' })).toMatchObject({
            definitionId: 'margaux',
            formatId: '',
            availability: BottleAvailability.AVAILABLE
        });
    });
});

describe('dropUnchanged', () => {
    it('keeps only the fields changed, so that the time of a date left alone stays', () => {
        const before = bottleFormValues(bottle);
        const form = new FormData();
        for (const [name, value] of Object.entries(before)) form.set(name, value);
        form.set('vintage', '2016');
        form.set('id', 'b1');

        dropUnchanged(form, before);

        expect([...form.keys()]).toEqual(['vintage', 'id']);
    });
});
