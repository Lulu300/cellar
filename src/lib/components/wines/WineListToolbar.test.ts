import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { readWineListQuery } from '#lib/utils/wine-filters.js';
import { useLocale } from '../../../test/locale';
import WineListToolbar from './WineListToolbar.svelte';

describe('WineListToolbar', () => {
    it('names the number field of the bottle count filter after its mode', () => {
        useLocale('fr');
        const query = readWineListQuery([
            ['bottles', 'at_least'],
            ['count', '3']
        ]);

        const { body } = render(WineListToolbar, {
            props: {
                query,
                onChange: () => {},
                wineCount: 1,
                bottleCount: 3,
                outOfCellarCount: 0,
                view: 'cards',
                showImages: false
            }
        });

        const field = body.match(/<input[^>]*type="number"[^>]*>/)?.[0];
        expect(field).toContain('aria-label="Au moins ce nombre de bouteilles"');
    });
});
