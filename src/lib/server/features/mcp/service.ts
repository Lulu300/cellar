import {
    createBottles,
    deleteBottlesById,
    getWineShortages,
    listBottlesWithDefinitions,
    updateBottles,
    type WineBottleWithFormat
} from '#lib/server/features/bottles/service.js';
import {
    createDefinition,
    editDefinition,
    getDefinitionDetails,
    listWines,
    originHandlers,
    wineClassificationHandlers,
    wineColorHandlers,
    wineFormatHandlers,
    wineTypeHandlers
} from '#lib/server/features/catalog/service.js';
import { appellationHandlers } from '#lib/server/features/geography/service.js';
import { storageOverview } from '#lib/server/features/storage/service.js';
import {
    changeWish,
    createWish,
    listWishes,
    removeWish,
    type WishChanges
} from '#lib/server/features/wishlist/service.js';
import { findBarcodeMatches } from '#lib/shared/barcode.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { BottleWithDefinitionDTO, WineGroupDTO } from '#lib/shared/dto.js';
import type { BottleChanges, BottleInput } from '#lib/shared/schemas/bottle.js';
import type { WineDefinitionInput } from '#lib/shared/schemas/wine.js';
import type { WishInput } from '#lib/shared/schemas/wish.js';
import { containerLabel } from '#lib/shared/storage.js';
import { compareText } from '#lib/utils/compare.js';
import { today } from '#lib/utils/format.js';

// What the tools of the MCP server answer. An assistant reads every word of an answer: each one
// keeps the fields that help it answer a question about the cellar, flat, and leaves out the
// images, the timestamps and the ids of references that the API gives, but those a write tool
// takes.

/** A wine as the wine list and the wine page give it. */
type Wine = Pick<
    WineGroupDTO['definition'],
    'id' | 'name' | 'producer' | 'color' | 'type' | 'appellation' | 'rating'
> & { classification?: string | null; grapeVarieties: string[] | null };
type Bottle = Omit<BottleWithDefinitionDTO, 'definition'>;

/** A day as YYYY-MM-DD: the dates of a bottle carry no time that matters. */
const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

function wineSummary(wine: Wine) {
    const { appellation } = wine;
    return {
        id: wine.id,
        name: wine.name,
        producer: wine.producer,
        color: wine.color,
        type: wine.type,
        classification: wine.classification,
        appellation: appellation.name,
        region: appellation.region.name,
        country: appellation.region.country.name,
        rating: wine.rating,
        grapes: wine.grapeVarieties ?? []
    };
}

function bottleSummary(bottle: Bottle) {
    const { storageCase } = bottle;
    return {
        id: bottle.id,
        availability: bottle.availability,
        vintage: bottle.vintage,
        optimum: bottle.optimum,
        format: bottle.format,
        location: storageCase && {
            container: storageCase.container && containerLabel(storageCase.container.name),
            case: storageCase.name
        },
        barcode: bottle.barcode,
        origin: bottle.origin?.name ?? null,
        purchasePrice: bottle.purchasePrice,
        purchaseDate: day(bottle.purchaseDate),
        currentValue: bottle.currentValue,
        consumedDate: day(bottle.consumedDate),
        notes: bottle.notes
    };
}

/** Whether a bottle has this availability. */
const isIn =
    (availability: BottleAvailability) =>
    (bottle: { availability: string }): boolean =>
        bottle.availability === availability;

/** Lowercase and without accents: « cotes du rhone » finds « Côtes du Rhône ». */
const searchable = (text: string) =>
    text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

/** Whether the texts of `fields` hold every word of `query` between them, capitals and accents aside. */
function matching(query: string) {
    const words = searchable(query).split(/\s+/).filter(Boolean);
    return (fields: (string | null | undefined)[]) => {
        const text = searchable(fields.join(' '));
        return words.every((word) => text.includes(word));
    };
}

export interface WineSearch {
    query?: string;
    inCellarOnly: boolean;
    limit: number;
}

/**
 * The wines whose texts hold every word of `query`, by name, each with how many bottles are in the
 * cellar and out of it, and the vintages of those in the cellar. `total` counts them all, beyond
 * `limit`.
 */
export function searchWines({ query = '', inCellarOnly, limit }: WineSearch) {
    const matches = matching(query);
    const found = listWines({ ownedOnly: true })
        .map(({ definition, bottles }) => {
            const inCellar = bottles.filter(isIn(BottleAvailability.AVAILABLE));
            return {
                ...wineSummary(definition),
                inCellar: inCellar.length,
                outOfCellar: bottles.filter(isIn(BottleAvailability.OUT_OF_CELLAR)).length,
                vintages: [...new Set(inCellar.map((bottle) => bottle.vintage))].sort(
                    (a, b) => (a ?? Infinity) - (b ?? Infinity)
                )
            };
        })
        .filter((wine) => {
            if (inCellarOnly && wine.inCellar === 0) return false;
            return matches([
                wine.name,
                wine.producer,
                wine.color,
                wine.type,
                wine.classification,
                wine.appellation,
                wine.region,
                wine.country,
                ...wine.grapes
            ]);
        })
        .sort((a, b) => compareText(a.name, b.name));
    return { total: found.length, wines: found.slice(0, limit) };
}

/**
 * The wine with its description and target, its bottles still owned with where each one is, and
 * those drunk. Throws a NotFoundError for an unknown wine.
 */
export function wineWithBottles(id: string) {
    const wine = getDefinitionDetails(id);
    const bottles = listBottlesWithDefinitions(id).map(bottleSummary);
    const consumed = isIn(BottleAvailability.CONSUMED);
    return {
        ...wineSummary(wine),
        description: wine.description,
        website: wine.website,
        targetQuantity: wine.targetQuantity,
        bottles: bottles.filter((bottle) => !consumed(bottle)),
        consumed: bottles.filter(consumed)
    };
}

/** A bottle of the whole cellar, with the wine it is a bottle of. */
function bottleWithWine({ definition, ...bottle }: BottleWithDefinitionDTO) {
    return {
        ...bottleSummary(bottle),
        wine: {
            id: definition.id,
            name: definition.name,
            producer: definition.producer,
            color: definition.color,
            type: definition.type
        }
    };
}

/**
 * The bottles of `barcode`, whatever their availability, with their wine: the code as typed, then
 * in other capitals, then the codes that end with it, as the bulk entry finds them.
 */
export function bottlesByBarcode(barcode: string) {
    const coded = listBottlesWithDefinitions().filter(
        (bottle): bottle is BottleWithDefinitionDTO & { barcode: string } => bottle.barcode !== null
    );
    return findBarcodeMatches(coded, barcode).map(bottleWithWine);
}

/** A day of a search: a bound left out or null sets no limit. */
type Bound = Date | null | undefined;

export interface BottleSearch {
    availability?: BottleAvailability;
    consumedFrom?: Bound;
    consumedTo?: Bound;
    purchasedFrom?: Bound;
    purchasedTo?: Bound;
    limit: number;
}

/** Whether `date` falls from `from` to `to`, both days included. */
function within(date: Date | null, from: Bound, to: Bound): boolean {
    if (!from && !to) return true;
    // Compared as days: a date of a bottle is the midnight of its day in UTC, or a time in it.
    const when = day(date);
    if (when === null) return false;
    return (!from || when >= day(from)!) && (!to || when <= day(to)!);
}

/** Two days, the latest first, a missing one last. */
const latestFirst = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

/**
 * The bottles of the whole cellar with this availability, drunk and bought within these days, each
 * with its wine: the latest drunk first, then the latest bought. `total` counts them all, beyond
 * `limit`.
 */
export function listBottles(search: BottleSearch) {
    const found = listBottlesWithDefinitions()
        .filter(
            (bottle) =>
                (!search.availability || bottle.availability === search.availability) &&
                within(bottle.consumedDate, search.consumedFrom, search.consumedTo) &&
                within(bottle.purchaseDate, search.purchasedFrom, search.purchasedTo)
        )
        .map(bottleWithWine)
        .sort(
            (a, b) =>
                latestFirst(a.consumedDate, b.consumedDate) ||
                latestFirst(a.purchaseDate, b.purchaseDate) ||
                compareText(a.wine.name, b.wine.name)
        );
    return { total: found.length, bottles: found.slice(0, search.limit) };
}

/** The wines below their target quantity, the largest shortage first. */
export async function wineShortages() {
    return (await getWineShortages()).map((wine) => ({
        id: wine.id,
        name: wine.name,
        producer: wine.producer,
        color: wine.color,
        type: wine.type,
        appellation: wine.appellation,
        region: wine.region,
        country: wine.country,
        targetQuantity: wine.targetQuantity,
        inCellar: wine.currentCount,
        missing: wine.shortage,
        averagePrice: wine.avgPrice
    }));
}

interface Load {
    capacity: number;
    bottles: number;
    free: number;
}

/** The capacity, bottles and room left of `loads` together. */
function totalOf(loads: Load[]): Load {
    const sum = (field: keyof Load) => loads.reduce((total, load) => total + load[field], 0);
    return { capacity: sum('capacity'), bottles: sum('bottles'), free: sum('free') };
}

/**
 * The room left in each case, container by container in the order of the storage page, with the
 * totals. A case holds its capacity in bottles in the cellar; one that holds more, from an import,
 * has no room left, and does not take room from the others.
 */
export function freeSpace() {
    const containers = storageOverview().map(({ name: container, cases }) => {
        const loads = cases.map(({ id, name, capacity, bottles }) => ({
            id,
            name,
            capacity,
            bottles,
            free: Math.max(0, capacity - bottles)
        }));
        return { name: containerLabel(container), ...totalOf(loads), cases: loads };
    });
    return { ...totalOf(containers), containers };
}

/** The id and name of each row of a reference list. */
const named = (rows: { id: string; name: string }[]) => rows.map(({ id, name }) => ({ id, name }));

/** The lists that the write tools take ids from, but the appellations, which are too many. */
export function choices() {
    return {
        formats: named(wineFormatHandlers.list()),
        colors: named(wineColorHandlers.list()),
        types: named(wineTypeHandlers.list()),
        classifications: named(wineClassificationHandlers.list()),
        origins: named(originHandlers.list())
    };
}

/** The most appellations that one search returns. */
export const MAX_APPELLATIONS = 50;

/**
 * The appellations whose name, region and country hold every word of `query`, by name, with their
 * region and country. `total` counts them all, beyond MAX_APPELLATIONS.
 */
export function searchAppellations(query: string) {
    const matches = matching(query);
    const found = appellationHandlers
        .list()
        .map((row) => ({
            id: row.id,
            name: row.name,
            // The lookup rows are typed for every table; an appellation's come with both names.
            region: row.regionName as string,
            country: row.countryName as string
        }))
        .filter(({ name, region, country }) => matches([name, region, country]));
    return { total: found.length, appellations: found.slice(0, MAX_APPELLATIONS) };
}

/** A bottle as a write tool answers it, once written. */
function writtenBottle(bottle: WineBottleWithFormat) {
    return {
        id: bottle.id,
        wineId: bottle.definitionId,
        availability: bottle.availability,
        vintage: bottle.vintage,
        optimum: bottle.optimum,
        format: bottle.format,
        caseId: bottle.storageCaseId,
        barcode: bottle.barcode,
        originId: bottle.originId,
        purchasePrice: bottle.purchasePrice,
        purchaseDate: day(bottle.purchaseDate),
        currentValue: bottle.currentValue,
        currentValueDate: day(bottle.currentValueDate),
        consumedDate: day(bottle.consumedDate),
        notes: bottle.notes
    };
}

/** Creates the wine, and answers it as get_wine does: without bottles yet. */
export function addWine(wine: WineDefinitionInput) {
    return wineWithBottles(createDefinition(wine).id);
}

/** The fields of a wine that update_wine changes: its photos and its rating have their own ways. */
export type WineChanges = Partial<Omit<WineDefinitionInput, 'imageId' | 'rating'>>;

/** Changes the fields of `changes` on the wine, and answers it as get_wine does. */
export function editWine(id: string, changes: WineChanges) {
    editDefinition(id, changes);
    return wineWithBottles(id);
}

/** The fields of the bottles that add_bottles creates: those of a purchase. */
export type NewBottles = Pick<
    BottleInput,
    | 'formatId'
    | 'originId'
    | 'vintage'
    | 'optimum'
    | 'purchasePrice'
    | 'purchaseDate'
    | 'barcode'
    | 'notes'
> & { wineId: string; quantity: number; caseId: string | null };

/** Creates `quantity` bottles of the wine in the cellar, all or none, as POST /api/bottles does. */
export function addBottles({ wineId, quantity, caseId, ...bottle }: NewBottles) {
    const created = createBottles(
        {
            ...bottle,
            definitionId: wineId,
            storageCaseId: caseId,
            availability: BottleAvailability.AVAILABLE,
            consumedDate: null,
            currentValue: null,
            currentValueDate: null
        },
        quantity
    );
    return created.map(writtenBottle);
}

/**
 * Marks the bottles drunk on `date`, today when null, as the status dialog does: they leave their
 * case, and `note` goes after their notes.
 */
export function markDrunk(ids: string[], date: Date | null, note: string | null) {
    const changes = {
        availability: BottleAvailability.CONSUMED,
        // Today on the server's calendar, stored as its midnight in UTC like a date of the forms.
        consumedDate: date ?? new Date(today())
    };
    return updateBottles(ids, changes, note).map(writtenBottle);
}

/**
 * Takes the bottles out of the cellar, as the status dialog does: each one keeps the case it was
 * in, which keeps no room for it, and a drunk one loses its consumed date.
 */
export function takeOut(ids: string[]) {
    return updateBottles(ids, { availability: BottleAvailability.OUT_OF_CELLAR }).map(
        writtenBottle
    );
}

/**
 * Puts the bottles back in the cellar, in the case `caseId`, or when null in the case they were
 * taken out of, as the status dialog does: a drunk bottle loses its consumed date, and has no case
 * left to go back to.
 */
export function putBack(ids: string[], caseId: string | null) {
    const changes = {
        availability: BottleAvailability.AVAILABLE,
        ...(caseId !== null && { storageCaseId: caseId })
    };
    return updateBottles(ids, changes).map(writtenBottle);
}

/** Puts the bottles in the case: a drunk bottle stays out of any case. */
export function moveBottles(ids: string[], caseId: string) {
    return updateBottles(ids, { storageCaseId: caseId }).map(writtenBottle);
}

/** The fields of bottles that update_bottles changes: those of their purchase and their label. */
export type BottleEdits = Pick<
    BottleChanges,
    | 'purchasePrice'
    | 'currentValue'
    | 'currentValueDate'
    | 'vintage'
    | 'optimum'
    | 'purchaseDate'
    | 'formatId'
    | 'originId'
    | 'barcode'
>;

/** Sets the fields of `changes` on each bottle, all or none, as PATCH /api/bottles does. */
export function editBottles(ids: string[], changes: BottleEdits) {
    return updateBottles(ids, changes).map(writtenBottle);
}

/** Deletes the bottles, all or none, and answers their ids. */
export function deleteBottles(ids: string[]) {
    return { deleted: deleteBottlesById(ids) };
}

/** Replaces the notes of the bottles when `notes` is given, then adds `addedNote` after them. */
export function changeBottleNotes(
    ids: string[],
    notes: string | null | undefined,
    addedNote: string | null
) {
    const changes = notes === undefined ? {} : { notes };
    return updateBottles(ids, changes, addedNote).map(writtenBottle);
}

/** Gives the wine `rating`, or none with null, and answers the wine without its bottles. */
export function rateWine(id: string, rating: number | null) {
    editDefinition(id, { rating });
    return wineSummary(getDefinitionDetails(id));
}

/** A wish without its photo, which an assistant cannot see. */
function wishSummary({ id, text, quantity, note, wine }: ReturnType<typeof listWishes>[number]) {
    return {
        id,
        text,
        quantity,
        note,
        wine: wine && {
            id: wine.id,
            name: wine.name,
            producer: wine.producer,
            color: wine.color,
            type: wine.type,
            appellation: wine.appellation,
            region: wine.region,
            country: wine.country,
            inCellar: wine.inCellar
        }
    };
}

/** The wishes, the newest first: a wine of the cellar, or the name of a wine not in it yet. */
export const wishlist = () => listWishes().map(wishSummary);

/** Adds a wine of the cellar, or a text, to the wishlist, and answers the wish as wishlist does. */
export const addWish = (wish: Omit<WishInput, 'imageId'>) =>
    wishSummary(createWish({ ...wish, imageId: null }));

/** Changes the quantity or the note of a wish, and answers it as wishlist does. */
export const editWish = (id: string, changes: WishChanges) => wishSummary(changeWish(id, changes));

/** Removes a wish from the wishlist. */
export async function removeWishById(id: string) {
    await removeWish(id);
    return { removed: id };
}
