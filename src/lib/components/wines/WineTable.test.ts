import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { WineGroupDTO } from '#lib/shared/dto.js';
import WineTable from './WineTable.svelte';

// The session and the wishlist of the page, as the root layout loads them
const pageData = vi.hoisted(() => ({ authenticated: false, wishedWines: {} }));
vi.mock('$app/state', () => ({ page: { data: pageData } }));

const wine = {
    definition: {
        id: 'w1',
        name: 'Clos Table',
        producer: null,
        region: 'Bourgogne',
        country: 'France',
        color: 'Rouge',
        colorHex: '#7b1e2b',
        classification: null,
        rating: null,
        imageId: 'i1'
    },
    bottles: []
} as unknown as WineGroupDTO;

function renderTable(authenticated: boolean, showImages = true) {
    pageData.authenticated = authenticated;
    const noop = () => {};
    return render(WineTable, {
        props: {
            wines: [wine],
            imageUrl: () => '/uploads/wines/label.jpg',
            showImages,
            onEdit: noop,
            onDuplicate: noop,
            onAddBottle: noop,
            onShowBottles: noop
        }
    }).body;
}

describe('WineTable', () => {
    // The items of a closed menu are not rendered: the phone menu of a visitor, which only shows
    // the bottles, is checked in the browser (FEAT-10 evidence).
    it('offers the actions that change the cellar only to a logged-in user', () => {
        const visitor = renderTable(false);
        expect(visitor).toContain('href="/wines/w1"');
        expect(visitor).not.toContain('aria-label="Add bottle of this wine"');
        expect(visitor).not.toContain('aria-label="Wishlist"');
        expect(visitor).not.toContain('>Actions<');

        const user = renderTable(true);
        expect(user).toContain('aria-label="Add bottle of this wine"');
        expect(user).toContain('aria-label="Wishlist"');
        expect(user).toContain('>Actions<');
    });

    it('shows a dash for a wine without a rating, which a screen reader reads as text', () => {
        expect(renderTable(false)).toMatch(
            /<span aria-hidden="true">—<\/span>\s*<span class="sr-only">No rating<\/span>/
        );
    });

    it('drops the thumbnails with the images hidden', () => {
        expect(renderTable(true)).toContain('src="/uploads/wines/label.jpg"');
        expect(renderTable(true, false)).not.toContain('<img');
    });
});
