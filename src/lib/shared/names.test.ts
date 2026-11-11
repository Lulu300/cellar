import { describe, expect, it } from 'vitest';
import { areClose, folded, producerKey, tidyName } from './names';

describe('the names of producers', () => {
    it('are stored with one space between words, and none around', () => {
        expect(tidyName('  Château  \t Margaux ')).toBe('Château Margaux');
        expect(tidyName(null)).toBe('');
    });

    // The grouping rule of FEAT-07, which migration 0023 applies too.
    it('are one producer whatever their case, accents, blanks and apostrophes', () => {
        const key = producerKey('Château Margaux');
        for (const spelling of [
            'chateau margaux',
            'Château  Margaux',
            'Château Margaux',
            ' CHÂTEAU MARGAUX '
        ]) {
            expect(producerKey(spelling)).toBe(key);
        }
        expect(producerKey('Domaine de l’Arlot')).toBe(producerKey("Domaine de l'Arlot"));
    });

    it('stay two producers when a space is missing, or the words differ', () => {
        expect(producerKey('ChâteauMargaux')).not.toBe(producerKey('Château Margaux'));
        expect(producerKey('Guigal')).not.toBe(producerKey('E. Guigal'));
        expect(producerKey('')).toBe('');
        expect(producerKey(undefined)).toBe('');
    });
});

describe('a search', () => {
    it('ignores case and accents', () => {
        expect(folded('Château Côté')).toBe('chateau cote');
        expect(folded('Château Margaux').includes(folded('CHAT'))).toBe(true);
        expect(folded('Château d’Yquem').includes(folded("d'yquem"))).toBe(true);
    });
});

describe('areClose', () => {
    it.each([
        ['Dom. Leflaive', 'Domaine Leflaive'],
        ['Guigal', 'E. Guigal'],
        ['Domaine Lefalive', 'Domaine Leflaive'],
        ['chateau margaux', 'Château Margaux']
    ])('finds « %s » close to « %s »', (a, b) => {
        expect(areClose(a, b)).toBe(true);
    });

    it.each([
        ['Producer 5', 'Producer 50'],
        ['Cuvée 2019', 'Cuvée 2020'],
        ['Domaine Roulot', 'Domaine Rapet'],
        ['Clos', 'Gros']
    ])('does not find « %s » close to « %s »', (a, b) => {
        expect(areClose(a, b)).toBe(false);
    });
});
