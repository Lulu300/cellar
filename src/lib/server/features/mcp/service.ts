import {
    getWineShortages,
    listBottlesWithDefinitions
} from '#lib/server/features/bottles/service.js';
import { getDefinitionDetails, listWines } from '#lib/server/features/catalog/service.js';
import { storageOverview } from '#lib/server/features/storage/service.js';
import { findBarcodeMatches } from '#lib/shared/barcode.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { BottleWithDefinitionDTO, WineGroupDTO } from '#lib/shared/dto.js';
import { containerLabel } from '#lib/shared/storage.js';
import { compareText } from '#lib/utils/compare.js';

// What the read tools of the MCP server answer. An assistant reads every word of an answer: each
// one keeps the fields that help it answer a question about the cellar, flat, and leaves out the
// ids of references, the images and the timestamps that the API gives.

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
    const words = searchable(query).split(/\s+/).filter(Boolean);
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
            const text = searchable(
                [
                    wine.name,
                    wine.producer,
                    wine.color,
                    wine.type,
                    wine.classification,
                    wine.appellation,
                    wine.region,
                    wine.country,
                    ...wine.grapes
                ].join(' ')
            );
            return words.every((word) => text.includes(word));
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

/**
 * The bottles of `barcode`, whatever their availability, with their wine: the code as typed, then
 * in other capitals, then the codes that end with it, as the bulk entry finds them.
 */
export function bottlesByBarcode(barcode: string) {
    const coded = listBottlesWithDefinitions().filter(
        (bottle): bottle is BottleWithDefinitionDTO & { barcode: string } => bottle.barcode !== null
    );
    return findBarcodeMatches(coded, barcode).map(({ definition, ...bottle }) => ({
        ...bottleSummary(bottle),
        wine: {
            id: definition.id,
            name: definition.name,
            producer: definition.producer,
            color: definition.color,
            type: definition.type
        }
    }));
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
        const loads = cases.map(({ name, capacity, bottles }) => ({
            name,
            capacity,
            bottles,
            free: Math.max(0, capacity - bottles)
        }));
        return { name: containerLabel(container), ...totalOf(loads), cases: loads };
    });
    return { ...totalOf(containers), containers };
}
