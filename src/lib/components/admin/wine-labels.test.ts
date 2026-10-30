import { describe, expect, it } from 'vitest';
import { bottleLabel, wineLabel } from './wine-labels';

describe('wineLabel', () => {
    it('names the producer and the wine', () => {
        expect(wineLabel({ producer: 'Château Margaux', name: 'Pavillon Rouge' })).toBe(
            'Château Margaux - Pavillon Rouge'
        );
    });

    it('leaves out a missing producer instead of writing "null"', () => {
        expect(wineLabel({ producer: null, name: 'Vin de table' })).toBe('Vin de table');
    });
});

describe('bottleLabel', () => {
    it('names the wine and the vintage', () => {
        expect(bottleLabel({ wineName: 'Pavillon Rouge', vintage: 2015 })).toBe(
            'Pavillon Rouge 2015'
        );
    });

    it('leaves out a missing vintage instead of writing "null"', () => {
        expect(bottleLabel({ wineName: 'Champagne Brut', vintage: null })).toBe('Champagne Brut');
    });
});
