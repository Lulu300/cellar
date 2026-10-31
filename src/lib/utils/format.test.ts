import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readNumber } from '#lib/shared/schemas/form.js';
import { plain, useLocale } from '../../test/locale';
import {
    formatCurrency,
    formatDate,
    formatFileSize,
    formatInputNumber,
    formatNumber,
    formatPriceRange,
    formatRating,
    formatVintageRange,
    isoDate,
    today
} from './format';

// Node reads TZ again whenever it changes: the day of the tests is the day in Paris.
process.env.TZ = 'Europe/Paris';

describe('formatDate and formatCurrency', () => {
    it('follow the language of the interface', () => {
        const day = new Date('2026-10-13T00:00:00Z');
        expect(formatDate(day)).toBe('Oct 13, 2026');
        expect(formatCurrency(12)).toBe('€12.00');

        useLocale('fr');
        expect(formatDate(day)).toBe('13 oct. 2026');
        expect(plain(formatCurrency(1234.5))).toBe('1 234,50 €');
        expect(plain(formatCurrency(1234.5, { wholeEuros: true }))).toBe('1 235 €');
    });

    it('read the JSON string of a date like the date', () => {
        expect(formatDate('2026-10-13T00:00:00.000Z')).toBe('Oct 13, 2026');
    });

    it('show the day that the server stored, also west of UTC', () => {
        // The server stores 1 January as its midnight in UTC: 31 December, 7 pm in New York.
        process.env.TZ = 'America/New_York';
        try {
            expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
        } finally {
            process.env.TZ = 'Europe/Paris';
        }
    });

    it('show N/A for a missing value but 0 as an amount', () => {
        expect(formatDate(null)).toBe('N/A');
        expect(formatCurrency(undefined)).toBe('N/A');
        expect(formatCurrency(0)).toBe('€0.00');
    });
});

describe('formatPriceRange', () => {
    it('gives one price when they are all the same, else the range and the average', () => {
        expect(formatPriceRange({ min: 9.5, max: 9.5, avg: 9.5 })).toBe('€9.50');
        expect(formatPriceRange({ min: 5, max: 15, avg: 10 })).toBe('€5.00 - €15.00 (€10.00)');
        expect(formatPriceRange(null)).toBe('N/A');
    });
});

describe('formatVintageRange', () => {
    it('gives one vintage, the oldest and the newest, or N/A', () => {
        expect(formatVintageRange({ oldest: 2015, newest: 2015 })).toBe('2015');
        expect(formatVintageRange({ oldest: 2010, newest: 2020 })).toBe('2010-2020');
        expect(formatVintageRange(null)).toBe('N/A');
    });
});

describe('formatRating', () => {
    it('draws five stars, or says there is no rating', () => {
        expect(formatRating(3)).toBe('★★★☆☆');
        expect(formatRating(3.5)).toBe('★★★★☆');
        expect(formatRating(4.4)).toBe('★★★★☆');
        expect(formatRating(0)).toBe('No rating');
        expect(formatRating(null)).toBe('No rating');
    });
});

describe('formatNumber', () => {
    it('groups the digits as the language of the interface does', () => {
        expect(formatNumber(10000)).toBe('10,000');
        useLocale('fr');
        expect(plain(formatNumber(10000))).toBe('10 000');
    });
});

describe('formatInputNumber', () => {
    it('writes a number in the language of the interface, without grouping', () => {
        expect(formatInputNumber(66.675)).toBe('66.675');
        expect(formatInputNumber(null)).toBe('');

        useLocale('fr');
        expect(formatInputNumber(66.675)).toBe('66,675');
        expect(formatInputNumber(12345.5)).toBe('12345,5');
        expect(formatInputNumber(0)).toBe('0');
    });

    it.each(['en', 'fr'] as const)('gives a text that readNumber reads back, in %s', (locale) => {
        useLocale(locale);
        for (const number of [66.675, -3.5, 12345.5, 0.1 + 0.2, 1e21, 1e-7]) {
            expect(readNumber(formatInputNumber(number))).toBe(number);
        }
    });
});

describe('formatFileSize', () => {
    it('picks the unit and translates it', () => {
        expect(formatFileSize(0)).toBe('0 bytes');
        expect(formatFileSize(1536 * 1024)).toBe('1.5 MB');
        useLocale('fr');
        expect(plain(formatFileSize(1536 * 1024))).toBe('1,5 Mo');
    });
});

describe('today', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('is the local day, also between midnight and 2 am in Paris', () => {
        // 00:30 on October 13 in Paris (UTC+2) is still October 12 in UTC.
        vi.setSystemTime(new Date('2026-10-12T22:30:00Z'));
        expect(today()).toBe('2026-10-13');
        // 01:59 in winter (UTC+1)
        vi.setSystemTime(new Date('2026-12-31T00:59:00Z'));
        expect(today()).toBe('2026-12-31');
    });

    it('is the same day in the evening', () => {
        vi.setSystemTime(new Date('2026-10-13T21:59:00Z'));
        expect(today()).toBe('2026-10-13');
    });
});

describe('isoDate', () => {
    it('gives back the day that the server stored, whatever the time zone', () => {
        // The server stores the day 2026-03-01 as its midnight in UTC.
        expect(isoDate(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03-01');
        expect(isoDate('2026-03-01T00:00:00.000Z')).toBe('2026-03-01');
    });
});
