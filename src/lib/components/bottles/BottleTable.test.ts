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

// FEAT-19: the page « À boire » gives its rank, « Prête » included, which no marker shows.
describe('the drinking window in BottleTable', () => {
    const table = (bottles: object[], columns: string[]) =>
        render(BottleTable, {
            props: {
                bottles: bottles as ReturnType<typeof bottle>[],
                columns: columns as ['drinking'],
                sort: { column: 'vintage', direction: 'asc' },
                onSort: () => {},
                emptyMessage: ''
            }
        }).body;

    it('writes « pas encore prête » after a window not open yet, in the cellar only', () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
        useLocale('fr');
        const notOpen = { drinkFrom: '2028', drinkBefore: null };
        const body = table(
            [
                { ...bottle('in', 'available'), ...notOpen },
                { ...bottle('out', 'out_of_cellar'), ...notOpen },
                { ...bottle('open', 'available'), drinkFrom: '2025', drinkBefore: '2030' }
            ],
            ['drinking']
        );

        expect(body.match(/dès 2028/g)).toHaveLength(2);
        expect(body.match(/pas encore prête/g)).toHaveLength(1);
        // Ready, it gets no chip outside the page « À boire ».
        expect(body).toContain('2025\u00a0– 2030');
        expect(body).not.toContain('Prête');
    });

    it('shows the rank that the page gives, « Prête » included', () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) });
        useLocale('fr');
        const ready = { ...bottle('open', 'available'), drinkFrom: '2025', drinkBefore: '2030' };

        expect(table([{ ...ready, rank: 'ready' }], ['urgency'])).toContain('Prête');
    });
});
