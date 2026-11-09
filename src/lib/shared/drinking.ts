/**
 * When to drink a bottle, never a wine: its drinking window (FEAT-05, FEAT-19), « à partir de »
 * and « avant fin », each a year, YYYY, or a month of a year, YYYY-MM, either one or both, and its
 * optimum year. Without a window end, the optimum year takes over. The rule lives here alone: the
 * page « À boire », the drink-soon banner, the storage marker and the MCP read it.
 */

/** How soon to drink a bottle, the most urgent first. */
export const DrinkingRank = {
    /** Its end has passed: flagged, and kept until the user changes or removes the date. */
    LATE: 'late',
    THIS_MONTH: 'this_month',
    THIS_YEAR: 'this_year',
    /** Its optimum year has come, and no end ranks it sooner. */
    OPTIMUM_REACHED: 'optimum_reached',
    /**
     * In its window, which ends after this year or never, before its optimum year or without one.
     * Listed on the page « À boire » only.
     */
    READY: 'ready',
    /** An end, or else an optimum year, after this year; or a window not open yet. */
    LATER: 'later'
} as const;

export type DrinkingRank = (typeof DrinkingRank)[keyof typeof DrinkingRank];

/** The ranks, the most urgent first. */
export const RANK_ORDER: readonly DrinkingRank[] = Object.values(DrinkingRank);

/**
 * The ranks of the bottles that the page « À boire » lists, the MCP with it: every rank but the
 * later one.
 */
export const TO_DRINK: readonly DrinkingRank[] = RANK_ORDER.filter(
    (rank) => rank !== DrinkingRank.LATER
);

/**
 * The ranks that the drink-soon banner, the storage marker and the notifications count, those of
 * FEAT-05: a ready bottle is listed on the page only, so that a cellar full of open windows does
 * not fill the banner.
 */
export const SOON: readonly DrinkingRank[] = TO_DRINK.filter((rank) => rank !== DrinkingRank.READY);

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
    /** « À partir de »: YYYY or YYYY-MM. */
    drinkFrom: string | null;
    /** « Avant fin », the end of the window: YYYY or YYYY-MM. */
    drinkBefore: string | null;
    optimum: number | null;
}

/** The year and the month, if any, of a window's start or end. */
export function parseYearMonth(date: string): { year: number; month: number | null } {
    const [year, month] = date.split('-').map(Number);
    return { year, month: month ?? null };
}

const monthNumber = ({ year, month }: Month) => year * 12 + month;

/** The last month of a window's end, as a number that orders them; a year alone ends in December. */
export function drinkBeforeMonth(drinkBefore: string): number {
    const { year, month } = parseYearMonth(drinkBefore);
    return monthNumber({ year, month: month ?? 12 });
}

/** The first month of a window's start; a year alone starts in January. */
function drinkFromMonth(drinkFrom: string): number {
    const { year, month } = parseYearMonth(drinkFrom);
    return monthNumber({ year, month: month ?? 1 });
}

/** Whether a window ends before it starts, which the bottles service and the imports refuse. */
export function endsBeforeStart({
    drinkFrom,
    drinkBefore
}: Pick<DrinkingDates, 'drinkFrom' | 'drinkBefore'>): boolean {
    return (
        drinkFrom !== null &&
        drinkBefore !== null &&
        drinkBeforeMonth(drinkBefore) < drinkFromMonth(drinkFrom)
    );
}

/** After any month number (9999-12 is 119,999), below the million that separates two ranks. */
const OPEN_END = 999_999;

const endOfYear = (year: number) => monthNumber({ year, month: 12 });

/**
 * The rank of the bottle in the month `now`, and its deadline, the last month to drink it in, which
 * orders the bottles of a rank: the end of its window, else December of its optimum year, else
 * last. A bottle at its optimum is ordered by its optimum year. Null without any date or optimum.
 */
function assess(
    { drinkFrom, drinkBefore, optimum }: DrinkingDates,
    now: Month
): { rank: DrinkingRank; deadline: number } | null {
    const deadline =
        drinkBefore !== null
            ? drinkBeforeMonth(drinkBefore)
            : optimum === null
              ? OPEN_END
              : endOfYear(optimum);
    // A window that ends after this year or never. One that ends sooner ranks by its end below, as
    // without a start, whether it is open or not.
    if (
        drinkFrom !== null &&
        (drinkBefore === null || parseYearMonth(drinkBefore).year > now.year)
    ) {
        if (drinkFromMonth(drinkFrom) > monthNumber(now)) {
            return { rank: DrinkingRank.LATER, deadline };
        }
        return optimum !== null && optimum <= now.year
            ? { rank: DrinkingRank.OPTIMUM_REACHED, deadline: endOfYear(optimum) }
            : { rank: DrinkingRank.READY, deadline };
    }
    if (drinkBefore === null) {
        if (optimum === null) return null;
        return {
            rank: optimum <= now.year ? DrinkingRank.OPTIMUM_REACHED : DrinkingRank.LATER,
            deadline
        };
    }
    const { year, month } = parseYearMonth(drinkBefore);
    if (deadline < monthNumber(now)) return { rank: DrinkingRank.LATE, deadline };
    if (year > now.year) return { rank: DrinkingRank.LATER, deadline };
    // A year alone ends in December: then it is this month's.
    const rank = (month ?? 12) === now.month ? DrinkingRank.THIS_MONTH : DrinkingRank.THIS_YEAR;
    return { rank, deadline };
}

/** How soon to drink the bottle in the month `now`; null without any date or optimum. */
export function drinkingRank(bottle: DrinkingDates, now: Month): DrinkingRank | null {
    return assess(bottle, now)?.rank ?? null;
}

/** Whether the window of the bottle has not opened in the month `now`: « pas encore prête ». */
export function notReadyYet(bottle: DrinkingDates, now: Month): boolean {
    // Ranked later with a start, its start is after `now`: an end this year or before ranks it sooner.
    return bottle.drinkFrom !== null && drinkingRank(bottle, now) === DrinkingRank.LATER;
}

/**
 * Where the bottle comes in the month `now` in the order of the page « À boire », the lowest
 * first: by rank, then by deadline. Null without any date or optimum. A number, which the bottle
 * tables sort on.
 */
export function urgency(bottle: DrinkingDates, now: Month): number | null {
    const assessed = assess(bottle, now);
    return assessed && RANK_ORDER.indexOf(assessed.rank) * 1_000_000 + assessed.deadline;
}

/**
 * Two bottles that have a rank, the one to drink first first: by rank, then by deadline. Equal
 * otherwise, for the caller to break the tie.
 */
export function compareDrinking(a: DrinkingDates, b: DrinkingDates, now: Month): number {
    return urgency(a, now)! - urgency(b, now)!;
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
 * only the ranks of SOON, and a later or ready bottle as later when its deadline falls within the
 * years of the horizon.
 */
export function rankWithin(
    bottle: DrinkingDates,
    horizon: DrinkingHorizon,
    now: Month
): DrinkingRank | null {
    const assessed = assess(bottle, now);
    if (assessed === null) return null;
    const { rank, deadline } = assessed;
    if (horizon === DrinkingHorizon.THIS_MONTH) {
        return rank === DrinkingRank.LATE || rank === DrinkingRank.THIS_MONTH ? rank : null;
    }
    if (SOON.includes(rank)) return rank;
    const lastMonth = endOfYear(now.year + YEARS_AHEAD[horizon]);
    return deadline <= lastMonth ? DrinkingRank.LATER : null;
}
