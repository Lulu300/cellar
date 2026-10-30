import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import CsvRangeCard from './CsvRangeCard.svelte';

/** The download button of the card as the server renders it. */
const downloadButton = (body: string) =>
    body.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Download CSV/)?.[0];

describe('CsvRangeCard', () => {
    // ABCDEF leaves 4 digits: numbers go up to 9,999.
    it('greys the download of a range past the last number of the prefix, and says why', () => {
        useLocale('en');

        const { body } = render(CsvRangeCard, {
            props: { prefix: 'ABCDEF', startNumber: 99_999, count: 25 }
        });

        expect(downloadButton(body)).toMatch(/\sdisabled(?=[\s=>])/);
        expect(body).toContain('Enter a whole number between 1 and 9,999.');
    });

    it('greys the download for a prefix that gives no code, and says why', () => {
        useLocale('en');

        const { body } = render(CsvRangeCard, {
            props: { prefix: 'AB C', prefixError: 'Bad prefix', startNumber: 5, count: 25 }
        });

        const button = downloadButton(body);
        expect(button).toMatch(/\sdisabled(?=[\s=>])/);
        expect(body.match(/Bad prefix/g)).toHaveLength(1);
        // Named by the button for assistive technologies
        const [, reasonId] = button?.match(/aria-describedby="([^"]+)"/) ?? [];
        expect(body).toMatch(new RegExp(`id="${reasonId}"[^>]*>Bad prefix<`));
    });

    it('lets a range that fits be downloaded', () => {
        useLocale('en');

        const { body } = render(CsvRangeCard, {
            props: { prefix: 'ABCDEF', startNumber: 9_990, count: 10 }
        });

        expect(downloadButton(body)).not.toMatch(/\sdisabled(?=[\s=>])/);
    });
});
