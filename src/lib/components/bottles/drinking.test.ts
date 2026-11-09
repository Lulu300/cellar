import { describe, expect, it } from 'vitest';
import { DrinkingHorizon } from '#lib/shared/drinking.js';
import { useLocale } from '../../../test/locale';
import { drinkBeforeText, drinkingText, marksByCase, marksName, windowText } from './drinking';

const november = { year: 2026, month: 11 };

describe('marksByCase', () => {
    const bottles = [
        { storageCaseId: 'a1', drinkFrom: null, drinkBefore: '2026-11', optimum: null },
        { storageCaseId: 'a1', drinkFrom: null, drinkBefore: '2025', optimum: null },
        { storageCaseId: 'a1', drinkFrom: null, drinkBefore: null, optimum: 2024 },
        { storageCaseId: 'a1', drinkFrom: null, drinkBefore: '2026-02', optimum: null },
        { storageCaseId: 'b1', drinkFrom: null, drinkBefore: '2027-06', optimum: null },
        { storageCaseId: 'b1', drinkFrom: null, drinkBefore: null, optimum: 2030 },
        // Ready: never marked as such, as later within the horizon of its end.
        { storageCaseId: 'c1', drinkFrom: '2024', drinkBefore: '2027', optimum: null }
    ];

    it('counts the bottles of each case by rank, the most urgent first', () => {
        expect(marksByCase(bottles, DrinkingHorizon.THIS_YEAR, november)).toEqual(
            new Map([
                [
                    'a1',
                    [
                        { rank: 'late', count: 2 },
                        { rank: 'this_month', count: 1 },
                        { rank: 'optimum_reached', count: 1 }
                    ]
                ]
            ])
        );
    });

    it('marks the later bottles within the horizon, and leaves out the others', () => {
        const marks = marksByCase(bottles, DrinkingHorizon.NEXT_YEAR, november);
        expect(marks.get('b1')).toEqual([{ rank: 'later', count: 1 }]);
        expect(marks.get('c1')).toEqual([{ rank: 'later', count: 1 }]);
        expect(marksByCase(bottles, DrinkingHorizon.THIS_MONTH, november).get('a1')).toEqual([
            { rank: 'late', count: 2 },
            { rank: 'this_month', count: 1 }
        ]);
    });
});

describe('the words of the marks and dates', () => {
    it('names the marks of a case for a screen reader', () => {
        useLocale('fr');
        expect(
            marksName([
                { rank: 'late', count: 1 },
                { rank: 'this_year', count: 2 }
            ])
        ).toBe('À boire : 1 en retard, 2 cette année');
    });

    // The decided wording: by the end of the month or of the year.
    it('says a month and a year alone « avant fin », and the optimum « apogée »', () => {
        useLocale('fr');
        expect(drinkBeforeText('2026-11')).toBe('avant fin nov. 2026');
        expect(drinkBeforeText('2026')).toBe('avant fin 2026');
        expect(drinkingText({ drinkFrom: null, drinkBefore: null, optimum: 2024 })).toBe(
            'apogée 2024'
        );
        expect(drinkingText({ drinkFrom: null, drinkBefore: null, optimum: null })).toBe('');
    });

    // The decided wording of a window (decision « Période de dégustation (FEAT-19) »).
    it('says a window « 2024 – 2032 », « sept. 2026 – mars 2027 », « dès 2028 »', () => {
        const at = (drinkFrom: string | null, drinkBefore: string | null, optimum = null) =>
            windowText({ drinkFrom, drinkBefore, optimum }, november);
        useLocale('fr');
        expect(at('2024', '2032')).toBe('2024\u00a0– 2032');
        expect(at('2026-09', '2027-03')).toBe('sept. 2026\u00a0– mars 2027');
        expect(at('2028', null)).toBe('dès 2028');
        expect(at(null, '2027')).toBe('avant fin 2027');
        expect(at(null, null)).toBe('');
        // Late, it keeps « avant fin … ».
        expect(at('2024', '2026-03')).toBe('avant fin mars 2026');
        useLocale('en');
        expect(at('2026-09', '2027-03')).toBe('Sep 2026\u00a0– Mar 2027');
        expect(at('2028', null)).toBe('from 2028');
    });

    it('says the optimum only without a window', () => {
        useLocale('fr');
        expect(drinkingText({ drinkFrom: '2028', drinkBefore: null, optimum: 2030 })).toBe(
            'dès 2028'
        );
    });
});
