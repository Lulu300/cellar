import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocale } from '../../../test/locale';
import BottleTable from './BottleTable.svelte';

afterEach(() => {
    vi.useRealTimers();
});

const bottle = (id: string, availability: string) => ({
    id,
    availability,
    vintage: 2015,
    format: 'Bottle',
    purchaseDate: null,
    purchasePrice: null,
    barcode: null,
    notes: null,
    drinkBefore: '2026-09',
    optimum: null
});

describe('the « to drink » column of BottleTable', () => {
    // Found by the FEAT-05 review: a bottle taken out kept its « late » chip.
    it('flags only a bottle in the cellar, and gives every bottle its date', () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
        useLocale('fr');
        const { body } = render(BottleTable, {
            props: {
                bottles: [bottle('in', 'available'), bottle('out', 'out_of_cellar')],
                columns: ['drinking'],
                sort: { column: 'vintage', direction: 'asc' },
                onSort: () => {},
                emptyMessage: ''
            }
        });

        expect(body.match(/En retard/g)).toHaveLength(1);
        expect(body.match(/avant fin sept\. 2026/g)).toHaveLength(2);
    });
});
