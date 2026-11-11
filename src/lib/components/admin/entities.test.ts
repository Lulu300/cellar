import { describe, expect, it } from 'vitest';
import { matchesReference } from './entities';

const margaux = {
    id: 'p1',
    name: 'Château Margaux',
    regionName: 'Bordeaux',
    countryName: 'France'
};

describe('the search of the reference lists of the admin', () => {
    it('ignores capitals and accents, as the lists of the forms do', () => {
        for (const query of ['chateau', 'CHÂTEAU', 'château marg', 'bordeaux', 'france']) {
            expect(matchesReference(margaux, query)).toBe(true);
        }
        expect(matchesReference(margaux, 'yquem')).toBe(false);
        expect(matchesReference({ id: 'c', name: 'Côte-Rôtie' }, 'cote-rotie')).toBe(true);
    });
});
