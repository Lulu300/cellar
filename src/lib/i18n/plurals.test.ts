import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';

const fr = { locale: 'fr' } as const;
const en = { locale: 'en' } as const;

describe('ICU plurals', () => {
    it('use the exact =0 case before the plural category, in French', () => {
        expect(m['bulk.codes_count']({ count: 0 }, fr)).toBe('Aucun code');
        expect(m['bulk.codes_count']({ count: 1 }, fr)).toBe('1 code');
        expect(m['bulk.codes_count']({ count: 2 }, fr)).toBe('2 codes');
        expect(m['bulk.summary']({ found: 0, issues: 0 }, fr)).toBe('Aucune bouteille trouvée');
        expect(m['bulk.summary']({ found: 3, issues: 1 }, fr)).toBe(
            '3 bouteilles trouvées, 1 ligne à vérifier'
        );
    });

    it('make 0 and 1 singular in French, but only 1 in English', () => {
        expect(m['common.n_bottles']({ count: 0 }, fr)).toBe('0 bouteille');
        expect(m['common.n_bottles']({ count: 1 }, fr)).toBe('1 bouteille');
        expect(m['common.n_bottles']({ count: 2 }, fr)).toBe('2 bouteilles');
        expect(m['common.n_bottles']({ count: 0 }, en)).toBe('0 bottles');
        expect(m['common.n_bottles']({ count: 1 }, en)).toBe('1 bottle');
    });

    it('write # as a number of the language', () => {
        expect(m['common.n_bottles']({ count: 1234 }, fr)).toBe('1 234 bouteilles');
        expect(m['common.n_bottles']({ count: 1234 }, en)).toBe('1,234 bottles');
    });
});
