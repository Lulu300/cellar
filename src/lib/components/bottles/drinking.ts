import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import {
    DrinkingRank,
    monthOf,
    rankWithin,
    type DrinkingDates,
    type DrinkingHorizon,
    type Month
} from '#lib/shared/drinking.js';

const RANK_LABELS: Record<DrinkingRank, () => string> = {
    late: m['drinking.late'],
    this_month: m['drinking.this_month'],
    this_year: m['drinking.this_year'],
    optimum_reached: m['drinking.optimum_reached'],
    later: m['drinking.later']
};

/** The name of a rank: « En retard », « Ce mois-ci »… */
export const rankLabel = (rank: DrinkingRank): string => RANK_LABELS[rank]();

const COUNTED_LABELS: Record<DrinkingRank, (inputs: { count: number }) => string> = {
    late: m['drinking.count_late'],
    this_month: m['drinking.count_this_month'],
    this_year: m['drinking.count_this_year'],
    optimum_reached: m['drinking.count_optimum_reached'],
    later: m['drinking.count_later']
};

/** How many bottles have a rank: « 2 en retard ». */
export const countedLabel = (rank: DrinkingRank, count: number): string =>
    COUNTED_LABELS[rank]({ count });

/** The rank of a bottle within `horizon`, in the browser's month: null when it is not marked. */
export const markedRank = (
    bottle: DrinkingDates,
    horizon: DrinkingHorizon,
    now: Month = monthOf(new Date())
) => rankWithin(bottle, horizon, now);

/** How many bottles of a case have a rank, the most urgent first. */
export type CaseMarks = { rank: DrinkingRank; count: number }[];

/** The marks of each case that holds bottles to drink within `horizon`, by case id. */
export function marksByCase(
    bottles: (DrinkingDates & { storageCaseId: string })[],
    horizon: DrinkingHorizon,
    now: Month = monthOf(new Date())
): Map<string, CaseMarks> {
    const counts = new Map<string, Map<DrinkingRank, number>>();
    for (const bottle of bottles) {
        const rank = rankWithin(bottle, horizon, now);
        if (rank === null) continue;
        const ranks = counts.get(bottle.storageCaseId) ?? new Map<DrinkingRank, number>();
        ranks.set(rank, (ranks.get(rank) ?? 0) + 1);
        counts.set(bottle.storageCaseId, ranks);
    }
    const order = Object.values(DrinkingRank);
    return new Map(
        [...counts].map(([caseId, ranks]) => [
            caseId,
            order.flatMap((rank) => (ranks.has(rank) ? [{ rank, count: ranks.get(rank)! }] : []))
        ])
    );
}

/** What a screen reader hears of the marks of a case: « À boire : 1 en retard, 2 cette année ». */
export const marksName = (marks: CaseMarks): string =>
    m['drinking.case_marks']({
        marks: marks.map(({ rank, count }) => countedLabel(rank, count)).join(', ')
    });

/** « nov. 2026 » */
function monthText(year: number, month: number): string {
    return new Intl.DateTimeFormat(getLocale(), { month: 'short', year: 'numeric' }).format(
        new Date(year, month - 1, 1)
    );
}

/** A « drink before » as the lists say it: « avant fin nov. 2026 », « avant fin 2026 ». */
export function drinkBeforeText(drinkBefore: string): string {
    const [year, month] = drinkBefore.split('-').map(Number);
    return m['drinking.before_end_of']({ date: month ? monthText(year, month) : String(year) });
}

/** What a list says of when to drink a bottle: its date, else its optimum year; empty without. */
export function drinkingText({ drinkBefore, optimum }: DrinkingDates): string {
    if (drinkBefore !== null) return drinkBeforeText(drinkBefore);
    return optimum === null ? '' : m['drinking.optimum_year']({ year: optimum });
}

/** The values of « this month » and « this year » in the browser's month: 2026-11 and 2026. */
export function quickDates(now: Month = monthOf(new Date())) {
    return {
        thisMonth: `${now.year}-${String(now.month).padStart(2, '0')}`,
        thisYear: String(now.year)
    };
}
