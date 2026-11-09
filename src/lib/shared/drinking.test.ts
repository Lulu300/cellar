import { describe, expect, it } from 'vitest';
import { bottleSchema } from '#lib/shared/schemas/bottle.js';
import {
    compareDrinking,
    drinkBeforeMonth,
    DrinkingHorizon,
    DrinkingRank,
    drinkingRank,
    endsBeforeStart,
    monthOf,
    notReadyYet,
    rankWithin,
    SOON,
    TO_DRINK,
    urgency,
    type DrinkingDates
} from './drinking';

const now = { year: 2026, month: 11 };
const dates = (drinkBefore: string | null, optimum: number | null = null): DrinkingDates => ({
    drinkFrom: null,
    drinkBefore,
    optimum
});
/** A bottle with a window start, « à partir de ». */
const withStart = (
    drinkFrom: string,
    drinkBefore: string | null = null,
    optimum: number | null = null
): DrinkingDates => ({ drinkFrom, drinkBefore, optimum });
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

describe('urgency', () => {
    it('puts any bottle of a rank before every bottle of the next one, whatever their dates', () => {
        const lateLongAfter = urgency(dates('2026-10'), now)!;
        const thisMonth = urgency(dates('2026-11'), now)!;
        const optimumLongAgo = urgency(dates(null, 1990), now)!;
        expect(lateLongAfter).toBeLessThan(thisMonth);
        expect(thisMonth).toBeLessThan(optimumLongAgo);
        expect(urgency(dates('1990'), now)).toBeLessThan(lateLongAfter);
    });

    it('gives none to a bottle with neither date nor optimum', () => {
        expect(urgency(dates(null), now)).toBeNull();
    });
});

describe('drinkBeforeMonth', () => {
    it('ends a year alone in its December, after each of its months', () => {
        expect(drinkBeforeMonth('2026')).toBe(drinkBeforeMonth('2026-12'));
        expect(drinkBeforeMonth('2026-11')).toBeLessThan(drinkBeforeMonth('2026'));
        expect(drinkBeforeMonth('2026')).toBeLessThan(drinkBeforeMonth('2027-01'));
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

// FEAT-19: the drinking window, « à partir de » next to « avant fin » (decision « Période de
// dégustation (FEAT-19) »).

describe('a bottle without a window start', () => {
    // Today's cases of FEAT-05, in November 2026: a bottle without a start ranks as before.
    const CASES: [string | null, number | null, DrinkingRank | null][] = [
        ['2025', null, DrinkingRank.LATE],
        ['2026-10', 2030, DrinkingRank.LATE],
        ['2026-11', 2023, DrinkingRank.THIS_MONTH],
        ['2026-12', null, DrinkingRank.THIS_YEAR],
        ['2026', null, DrinkingRank.THIS_YEAR],
        ['2027-01', null, DrinkingRank.LATER],
        ['2028', 2020, DrinkingRank.LATER],
        [null, 2020, DrinkingRank.OPTIMUM_REACHED],
        [null, 2026, DrinkingRank.OPTIMUM_REACHED],
        [null, 2027, DrinkingRank.LATER],
        [null, null, null]
    ];

    it.each(CASES)('ranks « avant fin » %s, optimum %s as before: %s', (before, optimum, rank) => {
        expect(drinkingRank(dates(before, optimum), now)).toBe(rank);
        expect(notReadyYet(dates(before, optimum), now)).toBe(false);
    });

    it('is never ready', () => {
        for (const [before, optimum] of CASES) {
            expect(drinkingRank(dates(before, optimum), now)).not.toBe(DrinkingRank.READY);
        }
    });
});

describe('drinkingRank with a window start', () => {
    const rankOf = (from: string, before: string | null = null, optimum: number | null = null) =>
        drinkingRank(withStart(from, before, optimum), now);

    it('is ready from the month of its start, a year alone from its January', () => {
        expect(rankOf('2026-11')).toBe(DrinkingRank.READY);
        expect(rankOf('2026')).toBe(DrinkingRank.READY);
        expect(rankOf('2020', '2032')).toBe(DrinkingRank.READY);
    });

    it('is later, not ready yet, before its start, whatever its optimum', () => {
        for (const bottle of [
            withStart('2026-12'),
            withStart('2027'),
            withStart('2028', '2045', 2020)
        ]) {
            expect(drinkingRank(bottle, now)).toBe(DrinkingRank.LATER);
            expect(notReadyYet(bottle, now)).toBe(true);
        }
        expect(notReadyYet(withStart('2026-11'), now)).toBe(false);
    });

    it('stays ready while its end is after this year, a month of next January included', () => {
        expect(rankOf('2025', '2027-01')).toBe(DrinkingRank.READY);
        expect(rankOf('2025', '2027')).toBe(DrinkingRank.READY);
    });

    it('ranks by its end, as without a start, once its end falls this year or has passed', () => {
        expect(rankOf('2025', '2026')).toBe(DrinkingRank.THIS_YEAR);
        expect(rankOf('2026-11', '2026-11')).toBe(DrinkingRank.THIS_MONTH);
        expect(rankOf('2024', '2026-03')).toBe(DrinkingRank.LATE);
        expect(rankOf('2020', '2025', 2022)).toBe(DrinkingRank.LATE);
        // Even before it opens: its end comes first.
        expect(rankOf('2026-12', '2026')).toBe(DrinkingRank.THIS_YEAR);
        expect(notReadyYet(withStart('2026-12', '2026'), now)).toBe(false);
    });

    it('is at its optimum once its optimum year has come, ready before', () => {
        expect(rankOf('2024', '2032', 2026)).toBe(DrinkingRank.OPTIMUM_REACHED);
        expect(rankOf('2020', null, 2022)).toBe(DrinkingRank.OPTIMUM_REACHED);
        expect(rankOf('2024', '2032', 2027)).toBe(DrinkingRank.READY);
    });
});

describe('the rank sets', () => {
    it('lists every rank but later on the page, and counts those of FEAT-05 on the banner', () => {
        expect(TO_DRINK).toEqual([
            DrinkingRank.LATE,
            DrinkingRank.THIS_MONTH,
            DrinkingRank.THIS_YEAR,
            DrinkingRank.OPTIMUM_REACHED,
            DrinkingRank.READY
        ]);
        expect(SOON).toEqual([
            DrinkingRank.LATE,
            DrinkingRank.THIS_MONTH,
            DrinkingRank.THIS_YEAR,
            DrinkingRank.OPTIMUM_REACHED
        ]);
    });
});

describe('the worked example of the proposal, in November 2026', () => {
    const BOTTLES = {
        rose: dates('2026-06'),
        chinon: dates('2026-11', 2023),
        meursault: dates('2026'),
        lamothe: dates(null, 2016),
        sancerre: withStart('2026-09', '2027-03'),
        coteRotie: withStart('2024', '2032', 2027),
        vouvray: withStart('2020', null, 2022),
        barolo: withStart('2028', '2045', 2032)
    };
    const ranked = Object.entries(BOTTLES).map(([name, bottle]) => ({
        name,
        bottle,
        rank: drinkingRank(bottle, now)!
    }));

    it('gives each bottle its rank, and the page lists all but the Barolo, not ready yet', () => {
        expect(Object.fromEntries(ranked.map(({ name, rank }) => [name, rank]))).toEqual({
            rose: 'late',
            chinon: 'this_month',
            meursault: 'this_year',
            lamothe: 'optimum_reached',
            sancerre: 'ready',
            coteRotie: 'ready',
            vouvray: 'optimum_reached',
            barolo: 'later'
        });
        expect(notReadyYet(BOTTLES.barolo, now)).toBe(true);
    });

    it('orders the page by rank, then by deadline: the optimum year for the bottles at theirs', () => {
        const listed = ranked
            .filter(({ rank }) => TO_DRINK.includes(rank))
            .sort((a, b) => compareDrinking(a.bottle, b.bottle, now))
            .map(({ name }) => name);
        expect(listed).toEqual([
            'rose',
            'chinon',
            'meursault',
            'lamothe',
            'vouvray',
            'sancerre',
            'coteRotie'
        ]);
    });

    it('keeps the counters of the banner to the ranks of FEAT-05', () => {
        const counted = ranked.filter(({ rank }) => SOON.includes(rank)).map(({ name }) => name);
        expect(counted).toEqual(['rose', 'chinon', 'meursault', 'lamothe', 'vouvray']);
    });
});

describe('urgency with a window start', () => {
    it('orders the ready bottles by their end, else their optimum year, else last', () => {
        const byEnd = withStart('2025', '2028');
        const byOptimum = withStart('2025', null, 2029);
        const open = withStart('2020');
        const sorted = [open, byOptimum, byEnd].sort((a, b) => compareDrinking(a, b, now));
        expect(sorted).toEqual([byEnd, byOptimum, open]);
        // After every bottle at its optimum, before none of another rank.
        expect(urgency(open, now)).toBeGreaterThan(urgency(dates(null, 2026), now)!);
    });
});

describe('rankWithin with a window start', () => {
    it('never marks a ready bottle as ready: as later when its deadline falls within the horizon', () => {
        const ready = withStart('2025', '2027');
        expect(rankWithin(ready, DrinkingHorizon.THIS_MONTH, now)).toBeNull();
        expect(rankWithin(ready, DrinkingHorizon.THIS_YEAR, now)).toBeNull();
        expect(rankWithin(ready, DrinkingHorizon.NEXT_YEAR, now)).toBe(DrinkingRank.LATER);
        expect(rankWithin(withStart('2025', null, 2027), DrinkingHorizon.NEXT_YEAR, now)).toBe(
            DrinkingRank.LATER
        );
        expect(rankWithin(withStart('2025'), DrinkingHorizon.TWO_YEARS, now)).toBeNull();
    });

    it('marks a bottle not ready yet as later within the horizon of its end', () => {
        const notReady = withStart('2027', '2028');
        expect(rankWithin(notReady, DrinkingHorizon.NEXT_YEAR, now)).toBeNull();
        expect(rankWithin(notReady, DrinkingHorizon.TWO_YEARS, now)).toBe(DrinkingRank.LATER);
    });

    it('marks a bottle at its optimum, as the banner counts it', () => {
        expect(rankWithin(withStart('2024', '2032', 2025), DrinkingHorizon.THIS_YEAR, now)).toBe(
            DrinkingRank.OPTIMUM_REACHED
        );
    });
});

describe('endsBeforeStart', () => {
    const reversed = (drinkFrom: string | null, drinkBefore: string | null) =>
        endsBeforeStart({ drinkFrom, drinkBefore });

    it('refuses an end before the start, by month or by year', () => {
        expect(reversed('2027', '2026')).toBe(true);
        expect(reversed('2026-02', '2026-01')).toBe(true);
        expect(reversed('2027-01', '2026')).toBe(true);
    });

    it('takes a window of one month or one year, and a year alone that holds the month', () => {
        expect(reversed('2026', '2026')).toBe(false);
        expect(reversed('2026-09', '2026-09')).toBe(false);
        expect(reversed('2026-09', '2026')).toBe(false);
        expect(reversed('2026', '2026-01')).toBe(false);
    });

    it('takes a window with one end only, or none', () => {
        expect(reversed('2030', null)).toBe(false);
        expect(reversed(null, '2020')).toBe(false);
        expect(reversed(null, null)).toBe(false);
    });
});

describe('the drinkFrom field', () => {
    const parse = (drinkFrom: unknown) => bottleSchema.shape.drinkFrom.safeParse(drinkFrom);

    it('takes a year or a month of a year, and reads empty as none, as drinkBefore', () => {
        expect(parse('2028').data).toBe('2028');
        expect(parse('2026-09').data).toBe('2026-09');
        expect(parse('').data).toBeNull();
        expect(parse('2026-13').success).toBe(false);
    });
});
