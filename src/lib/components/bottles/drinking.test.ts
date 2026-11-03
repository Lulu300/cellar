import { describe, expect, it } from 'vitest';
import { DrinkingHorizon } from '#lib/shared/drinking.js';
import { useLocale } from '../../../test/locale';
import { drinkBeforeText, drinkingText, marksByCase, marksName } from './drinking';

const november = { year: 2026, month: 11 };

describe('marksByCase', () => {
    const bottles = [
        { storageCaseId: 'a1', drinkBefore: '2026-11', optimum: null },
        { storageCaseId: 'a1', drinkBefore: '2025', optimum: null },
        { storageCaseId: 'a1', drinkBefore: null, optimum: 2024 },
        { storageCaseId: 'a1', drinkBefore: '2026-02', optimum: null },
        { storageCaseId: 'b1', drinkBefore: '2027-06', optimum: null },
        { storageCaseId: 'b1', drinkBefore: null, optimum: 2030 }
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
        expect(drinkingText({ drinkBefore: null, optimum: 2024 })).toBe('apogée 2024');
        expect(drinkingText({ drinkBefore: null, optimum: null })).toBe('');
    });
});
