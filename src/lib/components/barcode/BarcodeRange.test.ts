import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import BarcodeRange from './BarcodeRange.svelte';

describe('BarcodeRange', () => {
    // The /barcode page renders it on the server, which answered 500 for such a prefix.
    it('says that a prefix saved longer than 6 characters must change, instead of throwing', () => {
        useLocale('en');

        const { body } = render(BarcodeRange, { props: { prefix: 'OLDWINES', start: 1 } });

        expect(body).toContain('The barcode prefix is longer than 6 characters');
    });

    it('says it once for a range of codes', () => {
        useLocale('en');

        const { body } = render(BarcodeRange, {
            props: { prefix: 'OLDWINES', start: 1, count: 2 }
        });

        expect(body.match(/longer than 6 characters/g)).toHaveLength(1);
    });

    // ABCDEF leaves 4 digits: both ends of this range are past the last number.
    it('says once that a range is out of range, with the number in the language of the page', () => {
        useLocale('fr');

        const { body } = render(BarcodeRange, {
            props: { prefix: 'ABCDEF', start: 99_999, count: 25 }
        });

        expect(body.match(/hors plage/g)).toHaveLength(1);
        expect(body).toContain('9\u202f999');
    });
});
