import { describe, expect, it } from 'vitest';
import { csvDelimiterOptions } from './csv-tables.js';

describe('the delimiters of the CSV dialogs', () => {
    // The native select of 0.11 sent the two characters `\t` for "Tab", which no file holds.
    it('sends a real tab character for "Tab"', () => {
        const tab = csvDelimiterOptions().find((option) => option.label === 'Tab');
        expect(tab?.value).toBe('\t');
    });

    it('offers one character for each delimiter', () => {
        for (const { value } of csvDelimiterOptions()) expect(value).toHaveLength(1);
    });
});
