import { describe, expect, it } from 'vitest';
import { nameIsShared } from './compare';

describe('nameIsShared', () => {
    const regions = [
        { id: 'fr', name: 'Bourgogne' },
        { id: 'es', name: 'bourgogne' },
        { id: 'it', name: 'Bourgogné' },
        { id: 'bx', name: 'Bordeaux' }
    ];
    const shared = (id: string) =>
        nameIsShared(
            regions,
            regions.find((region) => region.id === id)!,
            (row) => row.name
        );

    it('finds another item of the same name, capitals and accents aside', () => {
        expect(shared('fr')).toBe(true);
        expect(shared('it')).toBe(true);
    });

    it('does not count the item itself', () => {
        expect(shared('bx')).toBe(false);
    });
});
