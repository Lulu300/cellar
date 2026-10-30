import { describe, expect, it } from 'vitest';
import { dateAfterInput, formatLocaleDate, parseLocaleDate } from './locale-date';

describe('formatLocaleDate and parseLocaleDate', () => {
    it('write the day first in French and the month first otherwise', () => {
        expect(formatLocaleDate('2024-03-15', 'fr')).toBe('15/03/2024');
        expect(formatLocaleDate('2024-03-15', 'en')).toBe('03/15/2024');
        expect(parseLocaleDate('15/03/2024', 'fr')).toBe('2024-03-15');
        expect(parseLocaleDate('03/15/2024', 'en')).toBe('2024-03-15');
    });

    it('read a date without leading zeros', () => {
        expect(parseLocaleDate('5/3/2024', 'fr')).toBe('2024-03-05');
    });

    it('reject a text that is not a complete date', () => {
        for (const text of ['', '15/03', '15/03/', '15-03-2024', 'aa/03/2024']) {
            expect(parseLocaleDate(text, 'fr')).toBe('');
        }
    });

    it('reject a day, a month or a year out of range', () => {
        for (const text of ['32/03/2024', '0/03/2024', '15/13/2024', '15/03/1899', '15/03/2101']) {
            expect(parseLocaleDate(text, 'fr')).toBe('');
        }
        expect(parseLocaleDate('15/03/2024', 'en')).toBe('');
    });

    // A date that the calendar lacks emptied the date input, so the form saved no date at all.
    it('reject a day that the month does not have, and text after a number', () => {
        for (const text of ['31/02/2025', '29/02/2025', '31/04/2025', '15x/03/2024']) {
            expect(parseLocaleDate(text, 'fr')).toBe('');
        }
        expect(parseLocaleDate('02/31/2025', 'en')).toBe('');
        expect(parseLocaleDate('29/02/2024', 'fr')).toBe('2024-02-29');
        expect(parseLocaleDate(' 29/02/2024 ', 'fr')).toBe('2024-02-29');
    });
});

describe('dateAfterInput', () => {
    it('keeps the date while the text is not a complete one', () => {
        // One Backspace at the end of a filled field erased the whole date.
        expect(dateAfterInput('15/03/202', 'fr', '2024-03-15')).toBe('2024-03-15');
        expect(dateAfterInput('15/03', 'fr', '2024-03-15')).toBe('2024-03-15');
    });

    it('takes the date once the text is a complete one', () => {
        expect(dateAfterInput('16/03/2024', 'fr', '2024-03-15')).toBe('2024-03-16');
        expect(dateAfterInput('03/16/2024', 'en', '')).toBe('2024-03-16');
    });

    it('clears the date when the text is emptied', () => {
        expect(dateAfterInput('', 'fr', '2024-03-15')).toBe('');
    });
});
