import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { ListedBottleDTO, WineGroupDTO } from '#lib/shared/dto.js';

/** What the bulk entry reads of a bottle to decide what an action changes on it. */
export interface BulkBottle {
    id: string;
    availability: string;
    storageCaseId?: string | null;
    storageCase?: { id: string } | null;
}

type LineState = 'found' | 'ambiguous' | 'not_found' | 'duplicate';

/** A checked code: the bottles it found when it was checked, and the one chosen among them. */
export interface Line<B extends BulkBottle> {
    code: string;
    matches: B[];
    chosenId: string;
    included: boolean;
}

export interface Row<B extends BulkBottle> extends Line<B> {
    index: number;
    bottle: B | null;
    state: LineState;
    willChange: boolean;
    locationIgnored: boolean;
}

/** A bottle of the wine list that has a barcode, with its wine. */
export type BarcodedBottle = ListedBottleDTO & {
    barcode: string;
    definition: WineGroupDTO['definition'];
};

/**
 * The bottles of the wine list that have a barcode, each with its wine: the list gives a wine's
 * bottles without repeating the wine on each.
 */
export function barcodedBottles<D, B extends { barcode: string | null }>(
    wines: { definition: D; bottles: B[] }[]
): (B & { barcode: string; definition: D })[] {
    return wines.flatMap(({ definition, bottles }) =>
        bottles.flatMap((bottle) =>
            bottle.barcode ? [{ ...bottle, barcode: bottle.barcode, definition }] : []
        )
    );
}

export function currentCaseId(bottle: BulkBottle): string | null {
    return bottle.storageCaseId ?? bottle.storageCase?.id ?? null;
}

function finalAvailability(bottle: BulkBottle, availability: string): string {
    return availability || bottle.availability;
}

function statusChanges(bottle: BulkBottle, availability: string): boolean {
    return !!availability && availability !== bottle.availability;
}

// A consumed bottle has no location (the API clears it), so a move never applies to it
function locationApplies(bottle: BulkBottle, availability: string, caseId: string): boolean {
    return !!caseId && finalAvailability(bottle, availability) !== BottleAvailability.CONSUMED;
}

function locationChanges(bottle: BulkBottle, availability: string, caseId: string): boolean {
    return locationApplies(bottle, availability, caseId) && currentCaseId(bottle) !== caseId;
}

/**
 * How many bottles of the checked rows the action that sets `availability` brings into the case
 * `caseId`: those found and kept that end up in the cellar and are not already there.
 */
export function incomingBottles<B extends BulkBottle>(
    rows: Row<B>[],
    availability: string,
    caseId: string
): number {
    return rows.filter(
        (row) =>
            row.state === 'found' &&
            row.included &&
            locationChanges(row.bottle!, availability, caseId)
    ).length;
}

/**
 * The rows of the checked lines, for the action that sets `availability` and the case `caseId`
 * (either may be ''). Each row reads its bottles in `current`, the bottles as last loaded: those
 * of a line date from when its code was checked, and the bottles may have changed since. A bottle
 * that `current` lacks, deleted meanwhile, keeps its old values: the server refuses it by name.
 */
export function computeRows<B extends BulkBottle>(
    lines: Line<B>[],
    current: Map<string, B>,
    availability: string,
    caseId: string
): Row<B>[] {
    const seenIds = new Set<string>();

    return lines.map((line, index) => {
        const matches = line.matches.map((match) => current.get(match.id) ?? match);
        const bottle = matches.find((match) => match.id === line.chosenId) || null;

        let state: LineState;
        if (matches.length === 0) {
            state = 'not_found';
        } else if (!bottle) {
            state = 'ambiguous';
        } else if (seenIds.has(bottle.id)) {
            state = 'duplicate';
        } else {
            state = 'found';
            seenIds.add(bottle.id);
        }

        return {
            ...line,
            matches,
            index,
            bottle,
            state,
            willChange:
                !!bottle &&
                (statusChanges(bottle, availability) ||
                    locationChanges(bottle, availability, caseId)),
            locationIgnored: !!bottle && !!caseId && !locationApplies(bottle, availability, caseId)
        };
    });
}
