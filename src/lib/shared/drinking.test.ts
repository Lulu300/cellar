import { describe, expect, it } from 'vitest';
import { bottleSchema } from '#lib/shared/schemas/bottle.js';
import {
    compareDrinking,
    DrinkingHorizon,
    DrinkingRank,
    drinkingRank,
    monthOf,
    rankWithin,
    type DrinkingDates
} from './drinking';

const now = { year: 2026, month: 11 };
const dates = (drinkBefore: string | null, optimum: number | null = null): DrinkingDates => ({
    drinkBefore,
    optimum
});
const rank = (drinkBefore: string | null, optimum: number | null = null) =>
    drinkingRank(dates(drinkBefore, optimum), now);

describe('drinkingRank', () => {
    it('ranks a passed date late, by its month or by its year alone', () => {
        expect(rank('2026-10')).toBe(DrinkingRank.LATE);
        expect(rank('2025-12')).toBe(DrinkingRank.LATE);
        expect(rank('2025')).toBe(DrinkingRank.LATE);
    });

    it('ranks this month, then the rest of this year, a year alone included', () => {
        expect(rank('2026-11')).toBe(DrinkingRank.THIS_MONTH);
        expect(rank('2026-12')).toBe(DrinkingRank.THIS_YEAR);
        expect(rank('2026')).toBe(DrinkingRank.THIS_YEAR);
    });

    // Decided after the review of FEAT-05: a date is « this month » when it ends this month.
    it('ranks a year alone this month in its December, then late', () => {
        expect(drinkingRank(dates('2026'), { year: 2026, month: 12 })).toBe(
            DrinkingRank.THIS_MONTH
        );
        expect(drinkingRank(dates('2026'), { year: 2027, month: 1 })).toBe(DrinkingRank.LATE);
        expect(
            rankWithin(dates('2026'), DrinkingHorizon.THIS_MONTH, { year: 2026, month: 12 })
        ).toBe(DrinkingRank.THIS_MONTH);
    });

    it('ranks a date after this year later', () => {
        expect(rank('2027-01')).toBe(DrinkingRank.LATER);
        expect(rank('2027')).toBe(DrinkingRank.LATER);
    });

    it('takes the optimum year only when no date is set', () => {
        expect(rank(null, 2026)).toBe(DrinkingRank.OPTIMUM_REACHED);
        expect(rank(null, 2020)).toBe(DrinkingRank.OPTIMUM_REACHED);
        expect(rank(null, 2027)).toBe(DrinkingRank.LATER);
        // A date set later than a reached optimum wins.
        expect(rank('2028', 2020)).toBe(DrinkingRank.LATER);
    });

    it('gives no rank to a bottle with neither date nor optimum', () => {
        expect(rank(null)).toBeNull();
    });
});

describe('compareDrinking', () => {
    const sorted = (bottles: DrinkingDates[]) =>
        [...bottles].sort((a, b) => compareDrinking(a, b, now));

    it('puts the late first, then this month, this year, the optimum reached, then later', () => {
        const later = dates('2028');
        const optimum = dates(null, 2024);
        const thisYear = dates('2026');
        const thisMonth = dates('2026-11');
        const late = dates('2026-03');
        expect(sorted([later, optimum, thisYear, thisMonth, late])).toEqual([
            late,
            thisMonth,
            thisYear,
            optimum,
            later
        ]);
    });

    it('orders a rank by date, the earliest first', () => {
        const year = dates('2024');
        const month = dates('2025-06');
        const older = dates('2023-02');
        expect(sorted([month, year, older])).toEqual([older, year, month]);
        expect(sorted([dates(null, 2025), dates(null, 2019)])).toEqual([
            dates(null, 2019),
            dates(null, 2025)
        ]);
    });

    it('leaves a tie to the caller: same rank, same deadline', () => {
        expect(compareDrinking(dates('2026'), dates('2026-12'), now)).toBe(0);
        expect(compareDrinking(dates(null, 2020), dates(null, 2020), now)).toBe(0);
    });
});

describe('monthOf', () => {
    it('counts January as 1', () => {
        expect(monthOf(new Date(2026, 0, 15))).toEqual({ year: 2026, month: 1 });
    });
});

describe('the drinkBefore field', () => {
    const parse = (drinkBefore: unknown) => bottleSchema.shape.drinkBefore.safeParse(drinkBefore);

    it('takes a year, or a month of a year', () => {
        expect(parse('2027').data).toBe('2027');
        expect(parse(' 2027-03 ').data).toBe('2027-03');
    });

    it('reads empty, null and missing as none', () => {
        expect(parse('').data).toBeNull();
        expect(parse(null).data).toBeNull();
        expect(parse(undefined).data).toBeNull();
    });

    it('refuses a month without a year, and any other text', () => {
        for (const value of ['03', '-03', '2027-13', '2027-00', '2027-3', '27', '0999', 2027]) {
            expect(parse(value).success, String(value)).toBe(false);
        }
    });
});

describe('rankWithin', () => {
    const within = (
        horizon: DrinkingHorizon,
        drinkBefore: string | null,
        optimum: number | null = null
    ) => rankWithin(dates(drinkBefore, optimum), horizon, now);

    it('keeps the late bottles and this month only, this month', () => {
        expect(within(DrinkingHorizon.THIS_MONTH, '2026-02')).toBe(DrinkingRank.LATE);
        expect(within(DrinkingHorizon.THIS_MONTH, '2026-11')).toBe(DrinkingRank.THIS_MONTH);
        expect(within(DrinkingHorizon.THIS_MONTH, '2026')).toBeNull();
        expect(within(DrinkingHorizon.THIS_MONTH, null, 2020)).toBeNull();
    });

    it('keeps the bottles to drink soon this year, as the banner does', () => {
        expect(within(DrinkingHorizon.THIS_YEAR, '2026')).toBe(DrinkingRank.THIS_YEAR);
        expect(within(DrinkingHorizon.THIS_YEAR, null, 2026)).toBe(DrinkingRank.OPTIMUM_REACHED);
        expect(within(DrinkingHorizon.THIS_YEAR, '2027-01')).toBeNull();
    });

    it('adds the bottles due next year, then the year after, by date or else by optimum', () => {
        expect(within(DrinkingHorizon.NEXT_YEAR, '2027-12')).toBe(DrinkingRank.LATER);
        expect(within(DrinkingHorizon.NEXT_YEAR, null, 2027)).toBe(DrinkingRank.LATER);
        expect(within(DrinkingHorizon.NEXT_YEAR, '2028')).toBeNull();
        expect(within(DrinkingHorizon.TWO_YEARS, '2028')).toBe(DrinkingRank.LATER);
        expect(within(DrinkingHorizon.TWO_YEARS, null, 2029)).toBeNull();
    });

    it('marks nothing for a bottle with neither date nor optimum', () => {
        expect(within(DrinkingHorizon.TWO_YEARS, null)).toBeNull();
    });
});
