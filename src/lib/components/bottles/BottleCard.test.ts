import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { BottleWithDefinitionDTO } from '#lib/shared/dto.js';
import BottleCard from './BottleCard.svelte';

vi.mock('#lib/stores/auth.svelte.js', () => ({ auth: { isAuthenticated: false } }));

const noop = () => {};
const renderCard = (bottle: Partial<BottleWithDefinitionDTO>) =>
    render(BottleCard, {
        props: {
            bottle: {
                id: 'b1',
                availability: 'available',
                vintage: 2018,
                drinkFrom: null,
                drinkBefore: null,
                optimum: null,
                ...bottle
            } as BottleWithDefinitionDTO,
            onStatus: noop,
            onDuplicate: noop,
            onEdit: noop,
            onBarcode: noop
        }
    }).body;

describe('BottleCard', () => {
    it('says when to drink the bottle, as the bottle tables do', () => {
        const card = renderCard({ drinkFrom: '2030-12', drinkBefore: '2030-12', optimum: 2031 });
        // A screen reader hears what the calendar icon means.
        expect(card).toContain('>Window:</span> Dec 2030');
        expect(card).toContain('peak 2031');
    });

    // As in the bottle tables: a bottle taken out or drunk keeps its dates, not its rank.
    it('gives only a bottle in the cellar its rank', () => {
        const late = { drinkFrom: null, drinkBefore: '2020' };
        expect(renderCard(late)).toContain('Late');
        expect(renderCard({ ...late, availability: 'consumed' })).not.toContain('Late');
        expect(renderCard({ ...late, availability: 'out_of_cellar' })).not.toContain('Late');
    });

    it('says nothing of a bottle without dates', () => {
        const card = renderCard({});
        expect(card).not.toContain('>Window:</span>');
        expect(card).not.toContain('peak');
    });
});
