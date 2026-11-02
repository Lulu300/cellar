/**
 * A bottle that a move puts in a case, as the case counts it: a case holds its bottles in the
 * cellar, and a bottle out of the cellar keeps its case without taking a place there.
 */
export interface MovedBottle {
    /** The case it has now, which it keeps out of the cellar. */
    caseId: string | null;
    /** Whether it is in the cellar now, taking a place in its case. */
    inCellar: boolean;
    /** Whether it is in the cellar after the change, taking a place in the case chosen. */
    inCellarAfter: boolean;
}

/** How many of the bottles a move to the case adds to it: those in the cellar after, and not there yet. */
export function bottlesComingIn(bottles: MovedBottle[], caseId: string): number {
    return bottles.filter(
        (bottle) => bottle.inCellarAfter && !(bottle.inCellar && bottle.caseId === caseId)
    ).length;
}

/**
 * The case that the bottles all leave, when they have one and the same, with the places they free
 * there: those of the bottles in the cellar.
 */
export function caseLeft(bottles: MovedBottle[]): { caseId: string; count: number } | undefined {
    const caseId = bottles[0]?.caseId;
    if (!caseId || bottles.some((bottle) => bottle.caseId !== caseId)) return undefined;
    return { caseId, count: bottles.filter((bottle) => bottle.inCellar).length };
}
