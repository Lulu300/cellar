import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import type { WineBottle } from '#lib/server/db/schema.js';
import { takeNextBarcodes } from '#lib/server/features/barcode/service.js';
import { existingCase, keepingCasesWithinCapacity } from '#lib/server/features/storage/service.js';
import { NotFoundError, ValidationError } from '#lib/server/http/errors.js';
import type { BottleChanges, BottleInput } from '#lib/shared/schemas/bottle.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { compareDrinking, drinkingRank, monthOf, SOON, type Month } from '#lib/shared/drinking.js';
import { LONG_TEXT_MAX_LENGTH } from '#lib/shared/schemas/common.js';
import type { BottleSortColumn, SortDirection } from '#lib/shared/schemas/bottle-list.js';
import { sortBottles } from '#lib/utils/bottle-sort.js';
import { compareText } from '#lib/utils/compare.js';
import {
    cellarStatistics,
    countBottlesByAvailability,
    deleteBottle,
    deleteBottles,
    findBottles,
    formatName,
    insertBottle,
    listBottlesByAvailability,
    listBottlesForAdmin,
    listBottlesInCase,
    listBottlesNotConsumed,
    listBottlesWithDefinitions,
    listBottlesWithoutDefinitions,
    listCaseDrinkingDates,
    updateBottle,
    winesBelowTarget
} from './repository';

export {
    countBottlesByAvailability,
    listCaseDrinkingDates,
    listBottlesForAdmin,
    listBottlesNotConsumed,
    listBottlesWithDefinitions,
    listBottlesWithoutDefinitions
};

/** A bottle with the name of its format. */
export type WineBottleWithFormat = WineBottle & { format: string };

type ConsumptionFields = Pick<WineBottle, 'availability' | 'consumedDate'>;

/**
 * Only a consumed bottle has a consumption date. A consumed bottle keeps its case, as one out of
 * the cellar does, without taking a place there: put back in the cellar, it goes back to it.
 */
function withConsumptionRule<Bottle extends ConsumptionFields>(bottle: Bottle): Bottle {
    return bottle.availability === BottleAvailability.CONSUMED
        ? bottle
        : { ...bottle, consumedDate: null };
}

/** `notes` followed by `note` on a new line, or `note` alone when there are no notes. */
function withNote(notes: string | null, note: string): string {
    return notes?.trim() ? `${notes}\n${note}` : note;
}

/**
 * What to write on `bottle`: `changes`, `addedNote` after its notes once changed, and the
 * consumption date that the consumption rule gives it once changed. Its case goes with them, the
 * one it has when `changes` leaves it: the capacity check reads it there, so that a bottle put back
 * in the cellar counts in the case it kept.
 */
function changesFor(
    bottle: WineBottle,
    changes: BottleChanges,
    addedNote: string | null
): BottleChanges {
    const changed = { ...bottle, ...changes };
    const { consumedDate } = withConsumptionRule(changed);
    return {
        ...changes,
        storageCaseId: changed.storageCaseId,
        consumedDate,
        ...(addedNote && { notes: withNote(changed.notes, addedNote) })
    };
}

/** Refuses (422) a manual barcode for several bottles, which cannot all have it. */
function checkBarcodeForOneBottle(barcode: string | null | undefined, count: number): void {
    if (barcode && count > 1) {
        throw new ValidationError(
            'barcode_for_one_bottle',
            'A barcode can only be given to a single bottle'
        );
    }
}

/**
 * Creates `quantity` bottles, all or none: a failed insert, a barcode out of range or a case
 * without room for them creates none. A barcode given goes on a single bottle, whatever the
 * settings. Without one, each available bottle takes the next automatic barcode, as in the CSV
 * import: a bottle out of the cellar or consumed has no label to scan.
 */
export function createBottles(data: BottleInput, quantity: number): WineBottleWithFormat[] {
    const bottle = withConsumptionRule(data);
    checkBarcodeForOneBottle(bottle.barcode, quantity);
    return keepingCasesWithinCapacity([bottle.storageCaseId], db, (tx) => {
        const takesNextBarcodes =
            !bottle.barcode && bottle.availability === BottleAvailability.AVAILABLE;
        const barcodes = takesNextBarcodes ? takeNextBarcodes(quantity, tx) : null;
        const inserted = Array.from({ length: quantity }, (_, i) =>
            insertBottle({ ...bottle, barcode: barcodes ? barcodes[i] : bottle.barcode }, tx)
        );
        // Once inserted, which refuses a format that does not exist.
        const format = formatName(bottle.formatId, tx);
        return inserted.map((row) => ({ ...row, format }));
    });
}

/**
 * The bottles of `ids`, by id. Throws a NotFoundError naming them when some do not exist, so that a
 * write of several bottles changes none.
 */
function existingBottles(ids: string[], tx: Tx): Map<string, WineBottle> {
    const found = new Map(findBottles(ids, tx).map((bottle) => [bottle.id, bottle]));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
        // The message names a few, for the logs; the details name them all, for the client.
        const named = missing.slice(0, 10).join(', ');
        const more = missing.length > 10 ? ` and ${missing.length - 10} more` : '';
        throw new NotFoundError(`No bottle with the id ${named}${more}`, { ids: missing });
    }
    return found;
}

/**
 * Sets the fields of `changes` on each bottle of `ids`, all or none, adds `addedNote` after their
 * notes, and leaves their other fields as they are; returns the bottles changed, once each, in the
 * order of `ids`. Throws, writing nothing:
 * - NotFoundError, naming them, when some of the bottles do not exist;
 * - ValidationError when it gives one manual barcode to several bottles, which cannot all have it;
 * - ValidationError, naming them, when `addedNote` would make the notes of some bottles longer than
 *   notes may be: cutting them would lose the end of the note without a word;
 * - CaseFullError when it would put one more available bottle in a case that has no room left.
 */
export function updateBottles(
    ids: string[],
    changes: BottleChanges,
    addedNote: string | null = null
): WineBottleWithFormat[] {
    const uniqueIds = [...new Set(ids)];
    checkBarcodeForOneBottle(changes.barcode, uniqueIds.length);
    return db.transaction((tx) => {
        const found = existingBottles(uniqueIds, tx);
        const writes = uniqueIds.map((id) => ({
            id,
            fields: changesFor(found.get(id)!, changes, addedNote)
        }));
        const tooLong = writes
            .filter(({ fields }) => (fields.notes?.length ?? 0) > LONG_TEXT_MAX_LENGTH)
            .map(({ id }) => id);
        if (tooLong.length > 0) {
            throw new ValidationError(
                'notes_too_long',
                `The note does not fit after the notes of ${tooLong.length} bottle(s): notes hold ${LONG_TEXT_MAX_LENGTH} characters at most`,
                { ids: tooLong, bottles: tooLong.length, maximum: LONG_TEXT_MAX_LENGTH }
            );
        }
        return keepingCasesWithinCapacity(
            writes.map(({ fields }) => fields.storageCaseId),
            tx,
            (tx) =>
                writes.map(({ id, fields }) => {
                    const bottle = updateBottle(id, fields, tx)!;
                    return { ...bottle, format: formatName(bottle.formatId, tx) };
                })
        );
    });
}

export interface BottlePageRequest {
    availabilities: BottleAvailability[];
    sort: BottleSortColumn;
    direction: SortDirection;
    /** From 1. */
    page: number;
    perPage: number;
}

/**
 * One page of the bottles of these availabilities, with how many there are and how many pages
 * they fill. A page past the last gives the last: bottles leave a list when their status changes.
 * SQLite would sort text by its bytes, capitals and accents apart: the bottles are sorted here, as
 * the tables of the browser sort them, then cut into pages. The id breaks ties, so that each
 * bottle shows on one page only.
 */
export function listBottlePage({
    availabilities,
    sort,
    direction,
    page,
    perPage
}: BottlePageRequest) {
    const all = sortBottles(listBottlesByAvailability(availabilities), { column: sort, direction });
    const pageCount = Math.max(1, Math.ceil(all.length / perPage));
    const current = Math.min(page, pageCount);
    const bottles = all.slice((current - 1) * perPage, current * perPage);
    return { bottles, total: all.length, page: current, pageCount };
}

/** The bottles that the case holds, with their wine. Throws a NotFoundError for an unknown case. */
export function listCaseBottles(caseId: string) {
    existingCase(caseId);
    return listBottlesInCase(caseId);
}

/**
 * The bottles in the cellar to drink soon in the month `now`, each with its rank: those whose date
 * has passed, then this month's, this year's, those whose optimum year has come; by date within a
 * rank, then by wine, vintage and id. A bottle drunk or taken out leaves the list, its date kept.
 */
export function listBottlesToDrink(now: Month = monthOf(new Date())) {
    return listBottlesByAvailability([BottleAvailability.AVAILABLE])
        .flatMap((bottle) => {
            const rank = drinkingRank(bottle, now);
            return rank !== null && SOON.includes(rank) ? [{ ...bottle, rank }] : [];
        })
        .sort(
            (a, b) =>
                compareDrinking(a, b, now) ||
                compareText(a.definition.name, b.definition.name) ||
                (a.vintage ?? 0) - (b.vintage ?? 0) ||
                a.id.localeCompare(b.id)
        );
}

/** updateBottles for one bottle. */
export function updateWineBottle(id: string, changes: BottleChanges): WineBottleWithFormat {
    return updateBottles([id], changes)[0];
}

export function deleteWineBottle(id: string): void {
    if (!deleteBottle(id)) throw new NotFoundError('Wine bottle not found');
}

/**
 * Deletes the bottles of `ids`, all or none, and returns their ids, once each: a NotFoundError
 * names those that do not exist.
 */
export function deleteBottlesById(ids: string[]): string[] {
    const uniqueIds = [...new Set(ids)];
    db.transaction((tx) => {
        existingBottles(uniqueIds, tx);
        deleteBottles(uniqueIds, tx);
    });
    return uniqueIds;
}

export async function getStatistics() {
    const { valueStats, totalStats, ...lists } = await cellarStatistics();
    return { ...lists, valueStats: valueStats[0], totalStats: totalStats[0] };
}

/**
 * The wines below their target quantity, with how far below, the largest shortage first, then by
 * name. The target is above the number of bottles, so it is at least 1.
 */
export async function getWineShortages() {
    return (await winesBelowTarget())
        .map((wine) => {
            const shortage = wine.targetQuantity - wine.currentCount;
            return {
                ...wine,
                shortage,
                shortagePercentage: Math.round((shortage / wine.targetQuantity) * 100),
                fulfillmentPercentage: Math.round((wine.currentCount / wine.targetQuantity) * 100)
            };
        })
        .sort((a, b) => b.shortage - a.shortage || compareText(a.name, b.name));
}
