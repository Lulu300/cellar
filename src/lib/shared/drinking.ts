/**
 * « À boire avant » (FEAT-05): a bottle, never a wine, may carry the year, or the month of a year,
 * by the end of which to drink it, written YYYY or YYYY-MM. Without one, its optimum year takes
 * over. The rule lives here alone: the drink-soon list, the storage marker and the MCP read it.
 */

/** How soon to drink a bottle, the most urgent first. */
export const DrinkingRank = {
    /** Its date has passed: flagged, and kept until the user changes or removes the date. */
    LATE: 'late',
    THIS_MONTH: 'this_month',
    THIS_YEAR: 'this_year',
    /** No date, and its optimum year has come. */
    OPTIMUM_REACHED: 'optimum_reached',
    /** A date, or else an optimum year, after this year. */
    LATER: 'later'
} as const;

export type DrinkingRank = (typeof DrinkingRank)[keyof typeof DrinkingRank];

const RANK_ORDER: readonly DrinkingRank[] = Object.values(DrinkingRank);

/** The ranks of the bottles to drink soon: the drink-soon list leaves the later ones out. */
export const SOON: readonly DrinkingRank[] = RANK_ORDER.filter(
    (rank) => rank !== DrinkingRank.LATER
);

/** A month of a year, January being 1. */
export interface Month {
    year: number;
    month: number;
}

/** The month of `date` on this clock: the server's for the lists it gives, the browser's for its own. */
export function monthOf(date: Date): Month {
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** What the rule reads of a bottle. */
export interface DrinkingDates {
    drinkBefore: string | null;
    optimum: number | null;
}

/** The year and the month, if any, of a « drink before ». */
function parsed(drinkBefore: string): { year: number; month: number | null } {
    const [year, month] = drinkBefore.split('-').map(Number);
    return { year, month: month ?? null };
}

/**
 * The last month to drink the bottle in, which orders bottles of a rank: that of its date,
 * December for a year alone, December of its optimum year when it has no date; null without either.
 */
function deadline({ drinkBefore, optimum }: DrinkingDates): Month | null {
    if (drinkBefore !== null) {
        const { year, month } = parsed(drinkBefore);
        return { year, month: month ?? 12 };
    }
    return optimum === null ? null : { year: optimum, month: 12 };
}

const monthNumber = ({ year, month }: Month) => year * 12 + month;

/** How soon to drink the bottle in the month `now`; null when it has neither date nor optimum. */
export function drinkingRank(bottle: DrinkingDates, now: Month): DrinkingRank | null {
    if (bottle.drinkBefore === null) {
        if (bottle.optimum === null) return null;
        return bottle.optimum <= now.year ? DrinkingRank.OPTIMUM_REACHED : DrinkingRank.LATER;
    }
    const { year, month } = parsed(bottle.drinkBefore);
    if (monthNumber({ year, month: month ?? 12 }) < monthNumber(now)) return DrinkingRank.LATE;
    if (year > now.year) return DrinkingRank.LATER;
    return month === now.month ? DrinkingRank.THIS_MONTH : DrinkingRank.THIS_YEAR;
}

/**
 * Two bottles that have a rank, the one to drink first first: by rank, then by deadline. Equal
 * otherwise, for the caller to break the tie.
 */
export function compareDrinking(a: DrinkingDates, b: DrinkingDates, now: Month): number {
    const rankA = RANK_ORDER.indexOf(drinkingRank(a, now)!);
    const rankB = RANK_ORDER.indexOf(drinkingRank(b, now)!);
    return rankA - rankB || monthNumber(deadline(a)!) - monthNumber(deadline(b)!);
}

/** How far ahead the storage marker looks, a preference of the browser. */
export const DrinkingHorizon = {
    /** The late bottles and this month's. */
    THIS_MONTH: 'this_month',
    /** The bottles to drink soon, as the banner of the wine list counts them. */
    THIS_YEAR: 'this_year',
    /** Those, and the bottles due next year. */
    NEXT_YEAR: 'next_year',
    /** Those, and the bottles due the year after. */
    TWO_YEARS: 'two_years'
} as const;

export type DrinkingHorizon = (typeof DrinkingHorizon)[keyof typeof DrinkingHorizon];

const YEARS_AHEAD: Record<DrinkingHorizon, number> = {
    this_month: 0,
    this_year: 0,
    next_year: 1,
    two_years: 2
};

/**
 * The rank of the bottle when it is to drink within `horizon` in the month `now`, null otherwise:
 * a later bottle counts when its deadline falls within the years of the horizon.
 */
export function rankWithin(
    bottle: DrinkingDates,
    horizon: DrinkingHorizon,
    now: Month
): DrinkingRank | null {
    const rank = drinkingRank(bottle, now);
    if (rank === null) return null;
    if (horizon === DrinkingHorizon.THIS_MONTH) {
        return rank === DrinkingRank.LATE || rank === DrinkingRank.THIS_MONTH ? rank : null;
    }
    if (rank !== DrinkingRank.LATER) return rank;
    return deadline(bottle)!.year <= now.year + YEARS_AHEAD[horizon] ? rank : null;
}
