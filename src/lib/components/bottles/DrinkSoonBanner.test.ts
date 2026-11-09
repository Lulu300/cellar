import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { BottleToDrinkDTO } from '#lib/shared/dto.js';
import type { DrinkingRank } from '#lib/shared/drinking.js';
import { useLocale } from '../../../test/locale';
import DrinkSoonBanner from './DrinkSoonBanner.svelte';

const bottle = (id: string, rank: DrinkingRank) =>
    ({
        id,
        rank,
        availability: 'available',
        vintage: 2018,
        optimum: null,
        drinkFrom: '2024',
        drinkBefore: '2032',
        storageCase: null,
        definition: { id: 'w', name: 'Côte-Rôtie', producer: null }
    }) as unknown as BottleToDrinkDTO;

const bannerOf = (bottles: BottleToDrinkDTO[]) =>
    render(DrinkSoonBanner, { props: { bottles } }).body;

// FEAT-19: « Prête » is listed on the page « À boire » only.
describe('DrinkSoonBanner', () => {
    it('counts the ranks of FEAT-05 only, never the ready bottles', () => {
        useLocale('fr');
        const body = bannerOf([bottle('a', 'optimum_reached'), bottle('b', 'ready')]);

        expect(body).toContain('1 à l’apogée');
        expect(body).not.toMatch(/prête/i);
    });

    it('is hidden when only ready bottles are listed', () => {
        useLocale('fr');
        expect(bannerOf([bottle('a', 'ready'), bottle('b', 'ready')])).not.toContain(
            'À boire bientôt'
        );
    });
});
