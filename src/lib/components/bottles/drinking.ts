import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import {
    drinkingRank,
    monthOf,
    SOON,
    type DrinkingDates,
    type DrinkingRank,
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

/** The rank of a bottle to drink soon in the browser's month, null for any other bottle. */
export function soonRank(bottle: DrinkingDates, now: Month = monthOf(new Date())) {
    const rank = drinkingRank(bottle, now);
    return rank !== null && SOON.includes(rank) ? rank : null;
}

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
