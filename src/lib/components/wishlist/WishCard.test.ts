import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import WishCard from './WishCard.svelte';
import type { Wish } from './wishes.js';

vi.mock('#lib/stores/auth.svelte.js', () => ({ auth: { isAuthenticated: true } }));

const noop = () => {};
const renderCard = (wish: Partial<Wish>) =>
    render(WishCard, {
        props: {
            wish: { id: 'w1', wine: null, text: null, imageUrl: null, ...wish } as Wish,
            showImage: false,
            onAddBottle: noop,
            onCreateWine: noop,
            onEdit: noop,
            onRemove: noop
        }
    }).body;

describe('WishCard', () => {
    // Each card repeats the same buttons: their names tell the wishes apart.
    it('names the button that creates the wine of a text wish after the wish', () => {
        const card = renderCard({ text: 'Clos Rougeard Le Bourg 2017' });
        expect(card).toContain('aria-label="Create the wine: Clos Rougeard Le Bourg 2017"');
    });
});
