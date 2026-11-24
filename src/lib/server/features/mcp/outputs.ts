import { z } from 'zod';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { TO_DRINK, type DrinkingRank } from '#lib/shared/drinking.js';

// What each tool of the MCP server answers, as its outputSchema declares it: the structured content
// of a successful call, which the tools build in service.ts and the server checks before it sends
// it. Every field is always there, null when empty; the text of the answer leaves those out.
// Strict objects: a field that the schema does not declare is refused here too, as a client's
// validator refuses it, since zod declares the objects closed (additionalProperties: false).

const text = z.string();
const maybeText = text.nullable();
const count = z.int();
/** A price or a value, in the cellar's currency. */
const amount = z.number().nullable();
/** A day, YYYY-MM-DD. */
const day = text.nullable();

const availability = z.enum(BottleAvailability);

/** Where a bottle is, or was: its container, by the name the storage page shows, and its case. */
const location = z.strictObject({ container: maybeText, case: text });

/** A bottle as the read tools give it: its places and its origin by name. */
const bottle = z.strictObject({
    id: text,
    availability,
    vintage: count.nullable(),
    optimum: count.nullable(),
    drinkFrom: maybeText,
    drinkBefore: maybeText,
    format: text,
    location: location.nullable(),
    formerLocation: location.nullable(),
    barcode: maybeText,
    origin: maybeText,
    purchasePrice: amount,
    purchaseDate: day,
    currentValue: amount,
    currentValueDate: day,
    consumedDate: day,
    notes: maybeText
});

/** A bottle with the wine it is a bottle of. */
const bottleWithWine = bottle.extend({
    wine: z.strictObject({
        id: text,
        name: text,
        producer: maybeText,
        color: text,
        type: text
    })
});

/** A bottle as the write tools answer it: the ids of its wine, its case and its origin. */
const writtenBottle = z.strictObject({
    id: text,
    wineId: text,
    availability,
    vintage: count.nullable(),
    optimum: count.nullable(),
    drinkFrom: maybeText,
    drinkBefore: maybeText,
    format: text,
    caseId: maybeText,
    formerCaseId: maybeText,
    barcode: maybeText,
    originId: maybeText,
    purchasePrice: amount,
    purchaseDate: day,
    currentValue: amount,
    currentValueDate: day,
    consumedDate: day,
    notes: maybeText
});

/** The answer of the tools that write bottles. */
export const writtenBottles = z.strictObject({ bottles: z.array(writtenBottle) });

/** A wine as search_wines lists it and rate_wine answers it. */
export const wineSummary = z.strictObject({
    id: text,
    name: text,
    producer: maybeText,
    producerId: maybeText,
    color: text,
    type: text,
    classification: maybeText,
    appellation: text,
    region: text,
    country: text,
    rating: z.number().nullable(),
    grapes: z.array(text)
});

// A tool that lists answers a page of what it found, with `total` counting them all.

export const winesFound = z.strictObject({
    total: count,
    wines: z.array(
        wineSummary.extend({
            inCellar: count,
            outOfCellar: count,
            vintages: z.array(count.nullable())
        })
    )
});

/** A wine with its bottles: get_wine, and add_wine and update_wine. */
export const wineDetails = wineSummary.extend({
    description: maybeText,
    website: maybeText,
    targetQuantity: count.nullable(),
    bottles: z.array(bottle),
    consumed: z.array(bottle)
});

export const bottlesByBarcode = z.strictObject({ bottles: z.array(bottleWithWine) });

export const bottlesFound = z.strictObject({ total: count, bottles: z.array(bottleWithWine) });

export const bottlesToDrink = z.strictObject({
    total: count,
    bottles: z.array(
        z.strictObject({
            rank: z.enum(TO_DRINK as [DrinkingRank, ...DrinkingRank[]]),
            ...bottleWithWine.shape
        })
    )
});

/** A count of the statistics, by the field that names what it counts. */
const countBy = <Fields extends z.ZodRawShape>(fields: Fields) =>
    z.array(z.strictObject({ ...fields, count }));

/** The answer of GET /api/statistics, which get_statistics gives as it is. */
export const statistics = z.strictObject({
    bottlesByAvailability: countBy({ availability }),
    winesByType: countBy({ type: text }),
    winesByColor: countBy({ color: text, hex: text }),
    winesByCountry: countBy({ country: text }),
    winesByRegion: countBy({ id: text, region: text, country: text }),
    winesByVintage: countBy({ vintage: count }),
    winesByDecade: countBy({ decade: count }),
    topProducers: countBy({ producerId: text, producer: text }),
    valueStats: z.strictObject({
        totalPurchaseValue: z.number(),
        totalCurrentValue: z.number(),
        totalHybridValue: z.number(),
        avgPurchasePrice: amount,
        avgCurrentValue: amount
    }),
    totalStats: z.strictObject({
        totalDefinitions: count,
        totalBottles: count,
        totalConsumed: count,
        totalOutOfCellar: count
    })
});

/** A wine of the cellar named with its place, as the shortage and the wishlist give it. */
const placedWine = {
    id: text,
    name: text,
    producer: maybeText,
    color: text,
    type: text,
    appellation: text,
    region: text,
    country: text
};

export const shortages = z.strictObject({
    wines: z.array(
        z.strictObject({
            ...placedWine,
            targetQuantity: count,
            inCellar: count,
            missing: count,
            averagePrice: amount
        })
    )
});

export const wish = z.strictObject({
    id: text,
    text: maybeText,
    quantity: count.nullable(),
    note: maybeText,
    wine: z.strictObject({ ...placedWine, inCellar: count }).nullable()
});

export const wishlist = z.strictObject({ wishes: z.array(wish) });

/** The room of a case, of a container or of the whole storage, in bottles. */
const load = { capacity: count, bottles: count, free: count };

export const freeSpace = z.strictObject({
    ...load,
    containers: z.array(
        z.strictObject({
            name: text,
            ...load,
            cases: z.array(z.strictObject({ id: text, name: text, ...load }))
        })
    )
});

const named = z.array(z.strictObject({ id: text, name: text }));

export const choices = z.strictObject({
    formats: named,
    colors: named,
    types: named,
    classifications: named,
    origins: named,
    countries: named,
    regions: z.array(z.strictObject({ id: text, name: text, country: text }))
});

export const appellationsFound = z.strictObject({
    total: count,
    appellations: z.array(z.strictObject({ id: text, name: text, region: text, country: text }))
});

/** A producer as list_producers gives it. */
const producerSummary = z.strictObject({
    id: text,
    name: text,
    region: maybeText,
    country: maybeText,
    wineCount: count,
    inCellar: count,
    consumed: count
});

export const producersFound = z.strictObject({ total: count, producers: z.array(producerSummary) });

/** A producer with its wines: get_producer and update_producer. */
export const producerDetails = producerSummary.extend({
    countryId: maybeText,
    regionId: maybeText,
    website: maybeText,
    contact: maybeText,
    description: maybeText,
    wines: z.array(
        z.strictObject({
            id: text,
            name: text,
            color: text,
            type: text,
            classification: maybeText,
            appellation: text,
            region: text,
            country: text,
            inCellar: count,
            consumed: count
        })
    )
});

export const createdProducer = z.strictObject({
    created: z.boolean(),
    ...producerDetails.shape
});

export const removedWish = z.strictObject({ removed: text });

export const deletedBottles = z.strictObject({ deleted: z.array(text) });
