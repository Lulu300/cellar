import {
    createMcpHandler,
    McpServer,
    type AuthInfo,
    type CallToolResult,
    type McpRequestContext,
    type ToolAnnotations
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { debugLogger } from '#lib/server/debug.js';
import { getStatistics } from '#lib/server/features/bottles/service.js';
import { apiErrorOf } from '#lib/server/http/handler.js';
import { runAsWrite } from '#lib/server/write-gate.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import {
    BARCODE_MAX_LENGTH,
    bottleChangesSchema,
    bottleSchema,
    bulkBottleChangesSchema,
    newBottlesSchema
} from '#lib/shared/schemas/bottle.js';
import {
    id,
    longText,
    NAME_MAX_LENGTH,
    optionalDate,
    optionalId
} from '#lib/shared/schemas/common.js';
import { rating, wineDefinitionSchema } from '#lib/shared/schemas/wine.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';
import {
    addBottles,
    addWine,
    bottlesByBarcode,
    changeBottleNotes,
    choices,
    deleteBottles,
    editBottles,
    editWine,
    editWish,
    freeSpace,
    listBottles,
    markDrunk,
    MAX_APPELLATIONS,
    moveBottles,
    addWish,
    putBack,
    rateWine,
    removeWishById,
    searchAppellations,
    searchWines,
    takeOut,
    wineShortages,
    wineWithBottles,
    wishlist
} from './service';
import { assertMcpWrite, ReadOnlyTokenError, type McpAccess } from './token';

/** The most results that one search or list returns. */
const MAX_SEARCH_LIMIT = 200;

const INSTRUCTIONS = `Cellar manages a home wine cellar. A wine (name, producer, appellation, color…) has bottles; each bottle is "available" (in the cellar, in a case of a storage container), "out_of_cellar" (taken out, not drunk yet) or "consumed" (drunk). "optimum" is the year a bottle is at its best. Prices are in the currency of the cellar's owner. A field left out of an answer is empty. The tools that change the cellar run only when its owner allowed changes for this token; they take the ids that the other tools give.`;

/** A tool that only reads: the client may call it without asking. */
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

/** A tool that adds to the cellar, changing nothing there. */
const ADDS: ToolAnnotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
};

/** A tool that changes what the cellar holds: `idempotent` when a second call changes nothing more. */
const changes = (idempotent: boolean): ToolAnnotations => ({
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: idempotent,
    openWorldHint: false
});

/** Leaves the empty fields out of an answer: an assistant reads every one of them. */
const withoutNulls = (_key: string, value: unknown) => (value === null ? undefined : value);

/**
 * The text of a refusal: its message, then the `details` that the API would answer with it, as
 * JSON on a line of their own. The message names a few of the bottles in cause; the details name
 * them all, or the wish already there, so that the assistant can act on them.
 */
function refusalText({ message, details }: { message: string; details?: unknown }): string {
    return details === undefined ? message : `${message}\nDetails: ${JSON.stringify(details)}`;
}

/**
 * The answer of a tool: what `read` returns as JSON, or the error to show the assistant. An error
 * that the API would answer, such as an unknown wine or a full case, and the refusal of a read-only
 * token say what went wrong; any other is logged and stays here.
 */
async function answer(tool: string, read: () => unknown): Promise<CallToolResult> {
    try {
        const text = JSON.stringify(await read(), withoutNulls);
        return { content: [{ type: 'text', text }] };
    } catch (error) {
        const refusal = error instanceof ReadOnlyTokenError ? error : apiErrorOf(error, 'POST');
        if (refusal)
            return { isError: true, content: [{ type: 'text', text: refusalText(refusal) }] };
        console.error(`MCP tool ${tool} failed:`, error);
        return { isError: true, content: [{ type: 'text', text: 'Internal server error' }] };
    }
}

/**
 * The answer of a write tool: refused to a read-only token, and while a restore, an import or a
 * wipe holds the writes. The write gate covers the write only.
 */
function answerWrite(tool: string, access: McpAccess, write: () => unknown) {
    return answer(tool, () => {
        assertMcpWrite(access);
        return runAsWrite(write);
    });
}

/** The bottles of a write tool, by the ids that the read tools give. */
const bottleIds = bulkBottleChangesSchema.shape.ids.describe(
    'The ids of the bottles, as get_wine, list_bottles or find_bottle_by_barcode give them.'
);

/** The most results of a read tool that lists. */
const limitParam = (what: string) =>
    z.int().min(1).max(MAX_SEARCH_LIMIT).default(50).describe(`The most ${what} to return.`);

// A tool that changes the fields given makes its arguments partial, but the ids of what it changes:
// a field that reads nothing as null, such as a producer, would otherwise clear it when left out.

/** Whether a write tool was given something to change besides the ids of what it changes. */
const changesSomething = (args: object) => Object.keys(args).length > 1;

/** A day of a write tool. */
const dateParam = (what: string) => optionalDate.describe(`YYYY-MM-DD: ${what}.`);

/**
 * What the token of the request allows, which serveMcp hands to the server of the request:
 * read-only when it says nothing.
 */
const accessOf = (authInfo: AuthInfo | undefined): McpAccess => ({
    write: authInfo?.extra?.write === true
});

/** The MCP server of one request, with every tool: those that write refuse a read-only token. */
function createServer({ authInfo }: McpRequestContext): McpServer {
    const access = accessOf(authInfo);
    const server = new McpServer(
        { name: 'cellar', version: __APP_VERSION__ },
        { instructions: INSTRUCTIONS }
    );

    server.registerTool(
        'search_wines',
        {
            title: 'Search wines',
            description:
                'Finds the wines of the cellar, sorted by name. Each comes with its bottles in the cellar (inCellar), out of it (outOfCellar), and the vintages of those in the cellar. total counts every wine found, beyond limit.',
            inputSchema: z.object({
                query: z
                    .string()
                    .max(NAME_MAX_LENGTH)
                    .optional()
                    .describe(
                        'Words that the wine must all hold, capitals and accents aside, in its name, producer, color, type, classification, appellation, region, country or grapes. Leave it out to list every wine.'
                    ),
                inCellarOnly: z
                    .boolean()
                    .default(false)
                    .describe('Only the wines with at least one bottle in the cellar.'),
                limit: limitParam('wines')
            }),
            annotations: READ_ONLY
        },
        (search) => answer('search_wines', () => searchWines(search))
    );

    server.registerTool(
        'get_wine',
        {
            title: 'Get a wine',
            description:
                'A wine with its description and target quantity, its bottles still owned (bottles) with the container and case of each one in the cellar, and its bottles drunk (consumed) with their date and notes.',
            inputSchema: z.object({
                wineId: id.describe('The id of the wine, as search_wines gives it.')
            }),
            annotations: READ_ONLY
        },
        ({ wineId }) => answer('get_wine', () => wineWithBottles(wineId))
    );

    server.registerTool(
        'find_bottle_by_barcode',
        {
            title: 'Find a bottle by its barcode',
            description:
                'The bottles of a barcode, whatever their availability, with their wine and where they are: the code as given, then in other capitals, then the codes that end with it. An empty list when none has it.',
            inputSchema: z.object({
                barcode: z
                    .string()
                    .trim()
                    .min(1)
                    .max(BARCODE_MAX_LENGTH)
                    .describe('The barcode on the label, or its end.')
            }),
            annotations: READ_ONLY
        },
        ({ barcode }) => answer('find_bottle_by_barcode', () => bottlesByBarcode(barcode))
    );

    server.registerTool(
        'get_statistics',
        {
            title: 'Cellar statistics',
            description:
                'The figures of the statistics page: bottles by availability, the value of the bottles in the cellar, and their numbers by type, color, country, region (top 10), vintage, decade and producer (top 10).',
            annotations: READ_ONLY
        },
        () => answer('get_statistics', getStatistics)
    );

    server.registerTool(
        'list_bottles',
        {
            title: 'List bottles',
            description:
                'The bottles of the whole cellar, or of one case, each with its wine and where it is, by availability and by day: what is in case B2, what was drunk this month, what is out of the cellar, what was bought last year. The latest drunk first, then the latest bought. total counts every bottle found, beyond limit. get_wine gives the bottles of one wine.',
            inputSchema: z.strictObject({
                caseId: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        'Only the bottles that this case holds, those in the cellar: the ids of get_free_space. An unknown id is refused.'
                    ),
                availability: z
                    .enum(BottleAvailability)
                    .optional()
                    .describe('Only the bottles with this availability. Left out, every bottle.'),
                consumedFrom: dateParam('only the bottles drunk on this day or later'),
                consumedTo: dateParam('only the bottles drunk on this day or earlier'),
                purchasedFrom: dateParam('only the bottles bought on this day or later'),
                purchasedTo: dateParam('only the bottles bought on this day or earlier'),
                limit: limitParam('bottles')
            }),
            annotations: READ_ONLY
        },
        (search) => answer('list_bottles', () => listBottles(search))
    );

    server.registerTool(
        'get_wine_shortage',
        {
            title: 'Wines to buy again',
            description:
                'The wines with fewer bottles in the cellar than their target quantity, the largest shortage (missing) first, with their average purchase price.',
            annotations: READ_ONLY
        },
        () => answer('get_wine_shortage', wineShortages)
    );

    server.registerTool(
        'get_wishlist',
        {
            title: 'Wishlist',
            description:
                'The wines the owner wants to buy, the newest first: each wish is a wine of the cellar (wine, with its bottles in the cellar, inCellar) or the name of a wine not in it yet (text), with how many bottles to buy (quantity) and a note. get_wine_shortage lists the wines below their target quantity, which are another reason to buy.',
            annotations: READ_ONLY
        },
        () => answer('get_wishlist', wishlist)
    );

    server.registerTool(
        'get_free_space',
        {
            title: 'Free space in storage',
            description:
                'The room left (free) in each case of each storage container, in bottles, with the totals: a case holds its capacity in bottles in the cellar. The id of a case is what list_bottles, add_bottles, move_bottles and put_bottles_back take.',
            annotations: READ_ONLY
        },
        () => answer('get_free_space', freeSpace)
    );

    server.registerTool(
        'list_choices',
        {
            title: 'Lists to choose from',
            description:
                'The id and name of each bottle format, wine color, wine type, classification and origin (where bottles were bought), for the ids that add_wine, update_wine, add_bottles and update_bottles take. search_appellations gives the appellations.',
            annotations: READ_ONLY
        },
        () => answer('list_choices', choices)
    );

    server.registerTool(
        'search_appellations',
        {
            title: 'Search appellations',
            description: `The appellations whose name, region and country hold every word of query, by name, with their id, region and country: at most ${MAX_APPELLATIONS}, total counting them all. Cellar knows only these: a missing one is added in the app.`,
            inputSchema: z.object({
                query: z
                    .string()
                    .max(NAME_MAX_LENGTH)
                    .describe(
                        'Words of the appellation, its region or its country, capitals and accents aside.'
                    )
            }),
            annotations: READ_ONLY
        },
        ({ query }) => answer('search_appellations', () => searchAppellations(query))
    );

    // The write tools: each one refuses a read-only token, and checks its arguments with the
    // rules of the API. An argument they do not know is refused, as PATCH /api/bottles refuses
    // a field: dropped, a misspelt one would leave the write done without it.

    server.registerTool(
        'add_wine',
        {
            title: 'Add a wine',
            description:
                'Creates a wine, without bottles: add_bottles adds them. Answers it as get_wine does. Look for it with search_wines first: a wine is added once, then gets bottles of each vintage.',
            inputSchema: wineDefinitionSchema
                .omit({ imageId: true })
                .extend({
                    appellationId: id.describe(
                        'The id of its appellation, from search_appellations.'
                    ),
                    typeId: id.describe('The id of its type, from list_choices.'),
                    colorId: id.describe('The id of its color, from list_choices.'),
                    classificationId: optionalId.describe(
                        'The id of its classification, from list_choices.'
                    ),
                    rating: wineDefinitionSchema.shape.rating.describe(
                        "The owner's rating, from 1 to 5, half points included."
                    ),
                    targetQuantity: wineDefinitionSchema.shape.targetQuantity.describe(
                        'How many bottles to keep in the cellar: get_wine_shortage lists the wines below it.'
                    )
                })
                .strict(),
            annotations: ADDS
        },
        (wine) => answerWrite('add_wine', access, () => addWine({ ...wine, imageId: null }))
    );

    server.registerTool(
        'add_bottles',
        {
            title: 'Add bottles',
            description:
                'Adds bottles of a wine to the cellar, all alike, each with its own id and, when Cellar numbers them, its own barcode. All or none: a case without room for them adds none. When the wine is on the wishlist (get_wishlist), ask the owner whether to remove it with remove_wish.',
            inputSchema: z
                .object({
                    wineId: id.describe('The id of the wine, from search_wines or add_wine.'),
                    quantity: newBottlesSchema.shape.quantity.describe('How many bottles to add.'),
                    formatId: id.describe('The id of their format, from list_choices.'),
                    vintage: bottleSchema.shape.vintage.describe(
                        'Their vintage, a year: 0 or left out for a wine without one.'
                    ),
                    optimum: bottleSchema.shape.optimum.describe(
                        'The year they are at their best.'
                    ),
                    originId: optionalId.describe(
                        'The id of where they were bought, from list_choices.'
                    ),
                    purchasePrice: bottleSchema.shape.purchasePrice.describe(
                        'The price of one bottle, in the currency of the owner.'
                    ),
                    purchaseDate: dateParam('the day they were bought'),
                    caseId: optionalId.describe('The id of their case, from get_free_space.'),
                    barcode: bottleSchema.shape.barcode.describe(
                        'The barcode of their label, for a single bottle: left out, Cellar numbers them when its automatic barcodes are on.'
                    ),
                    notes: bottleSchema.shape.notes.describe('Notes, on each bottle.')
                })
                .strict(),
            annotations: ADDS
        },
        (bottles) => answerWrite('add_bottles', access, () => addBottles(bottles))
    );

    server.registerTool(
        'add_wish',
        {
            title: 'Add to the wishlist',
            description:
                'Adds a wine to buy to the wishlist: a wine of the cellar by its id, at most once, or the name of a wine not in the cellar yet as text. Answers the wish as get_wishlist does.',
            inputSchema: z
                .strictObject({
                    wineId: optionalId.describe(
                        'The id of a wine of the cellar, from search_wines. Give it or text.'
                    ),
                    text: wishSchema.shape.text.describe(
                        'The name of a wine not in the cellar yet, as the owner would write it. Give it or wineId.'
                    ),
                    quantity: wishSchema.shape.quantity.describe('How many bottles to buy.'),
                    note: wishSchema.shape.note.describe(
                        'A note: where to buy it, for which occasion…'
                    )
                })
                .refine(
                    ({ wineId, text }) => (wineId === null) !== (text === null),
                    'Give wineId or text, not both'
                ),
            annotations: ADDS
        },
        ({ wineId, ...wish }) =>
            answerWrite('add_wish', access, () => addWish({ ...wish, definitionId: wineId }))
    );

    server.registerTool(
        'remove_wish',
        {
            title: 'Remove from the wishlist',
            description:
                'Removes a wish from the wishlist, such as a wine just bought: ask the owner first, as the app does.',
            inputSchema: z.strictObject({
                wishId: id.describe('The id of the wish, from get_wishlist.')
            }),
            annotations: changes(true)
        },
        ({ wishId }) => answerWrite('remove_wish', access, () => removeWishById(wishId))
    );

    server.registerTool(
        'mark_bottles_drunk',
        {
            title: 'Mark bottles drunk',
            description:
                'Marks bottles as drunk on a day: they leave their case, and the note goes after the notes of each one. A bottle already drunk takes the new day, and the note too. All or none.',
            inputSchema: z.strictObject({
                bottleIds,
                date: dateParam(
                    "the day they were drunk, on the owner's calendar; left out, today on the server's clock, often in UTC"
                ),
                note: longText.describe('A note to add after the notes of each bottle.')
            }),
            annotations: changes(false)
        },
        ({ bottleIds, date, note }) =>
            answerWrite('mark_bottles_drunk', access, () => markDrunk(bottleIds, date, note))
    );

    server.registerTool(
        'move_bottles',
        {
            title: 'Move bottles',
            description:
                'Puts bottles in a case, keeping their availability: a bottle drunk stays out of any case. All or none: a case without room for them moves none.',
            inputSchema: z.strictObject({
                bottleIds,
                caseId: id.describe('The id of the case, from get_free_space.')
            }),
            annotations: changes(true)
        },
        ({ bottleIds, caseId }) =>
            answerWrite('move_bottles', access, () => moveBottles(bottleIds, caseId))
    );

    server.registerTool(
        'update_bottle_notes',
        {
            title: 'Change the notes of bottles',
            description:
                'Replaces the notes of bottles with notes, adds addedNote after them, or both. All or none.',
            inputSchema: z
                .strictObject({
                    bottleIds,
                    notes: bottleChangesSchema.shape.notes.describe(
                        'Their new notes, in place of the old ones: empty or null removes them.'
                    ),
                    addedNote: longText.describe('A note to add after the notes of each bottle.')
                })
                .refine(
                    ({ notes, addedNote }) => notes !== undefined || addedNote !== null,
                    'Give notes, addedNote or both'
                ),
            annotations: changes(false)
        },
        ({ bottleIds, notes, addedNote }) =>
            answerWrite('update_bottle_notes', access, () =>
                changeBottleNotes(bottleIds, notes, addedNote)
            )
    );

    server.registerTool(
        'rate_wine',
        {
            title: 'Rate a wine',
            description: "Gives a wine the owner's rating, or removes it.",
            inputSchema: z.strictObject({
                wineId: id.describe('The id of the wine, from search_wines.'),
                rating: rating
                    .nullable()
                    .describe('From 1 to 5, half points included: null removes the rating.')
            }),
            annotations: changes(true)
        },
        ({ wineId, rating }) => answerWrite('rate_wine', access, () => rateWine(wineId, rating))
    );

    const wine = wineDefinitionSchema.shape;
    server.registerTool(
        'update_wine',
        {
            title: 'Change a wine',
            description:
                'Changes the fields given of a wine, as its form in the app does; the others stay, and null removes an optional one. rate_wine changes its rating, and its photos are changed in the app. Answers the wine as get_wine does.',
            inputSchema: z
                .strictObject({
                    wineId: id.describe('The id of the wine, from search_wines.'),
                    name: wine.name.describe('Its name.'),
                    producer: wine.producer.describe('Its producer.'),
                    appellationId: id.describe(
                        'The id of its appellation, from search_appellations.'
                    ),
                    typeId: id.describe('The id of its type, from list_choices.'),
                    colorId: id.describe('The id of its color, from list_choices.'),
                    classificationId: optionalId.describe(
                        'The id of its classification, from list_choices.'
                    ),
                    website: wine.website.describe('Its website, an http(s) address.'),
                    description: wine.description.describe('Its description.'),
                    grapeVarieties: wine.grapeVarieties
                        .unwrap()
                        .describe('Its grapes, in place of the old ones: [] removes them.'),
                    targetQuantity: wine.targetQuantity.describe(
                        'How many bottles to keep in the cellar: get_wine_shortage lists the wines below it.'
                    )
                })
                .partial()
                .required({ wineId: true })
                .refine(changesSomething, 'Give at least one field to change'),
            annotations: changes(true)
        },
        ({ wineId, ...changes }) =>
            answerWrite('update_wine', access, () => editWine(wineId, changes))
    );

    const bottle = bottleChangesSchema.shape;
    server.registerTool(
        'update_bottles',
        {
            title: 'Change bottles',
            description:
                'Gives each bottle the fields given, the same for all; the others stay, and null removes an optional one. All or none. Other changes have their own tools: notes with update_bottle_notes, the case with move_bottles, drunk with mark_bottles_drunk, out of or back in the cellar with take_bottles_out and put_bottles_back.',
            inputSchema: z
                .strictObject({
                    bottleIds,
                    purchasePrice: bottle.purchasePrice.describe(
                        'The price of one bottle, in the currency of the owner.'
                    ),
                    purchaseDate: dateParam('the day they were bought'),
                    currentValue: bottle.currentValue.describe(
                        'What one bottle is worth now, in the currency of the owner.'
                    ),
                    currentValueDate: dateParam('the day currentValue was estimated'),
                    vintage: bottle.vintage.describe(
                        'Their vintage, a year: 0 or null for a wine without one.'
                    ),
                    optimum: bottle.optimum.describe('The year they are at their best.'),
                    formatId: id.describe('The id of their format, from list_choices.'),
                    originId: optionalId.describe(
                        'The id of where they were bought, from list_choices.'
                    ),
                    barcode: bottle.barcode.describe(
                        'The barcode of the label, for a single bottle: no two bottles share one.'
                    )
                })
                .partial()
                .required({ bottleIds: true })
                .refine(changesSomething, 'Give at least one field to change'),
            annotations: changes(true)
        },
        ({ bottleIds, ...changes }) =>
            answerWrite('update_bottles', access, () => editBottles(bottleIds, changes))
    );

    server.registerTool(
        'take_bottles_out',
        {
            title: 'Take bottles out of the cellar',
            description:
                "Takes bottles out of the cellar without drinking them yet, such as a bottle set aside for tonight's dinner or brought to friends: they become out_of_cellar, as in the app's status dialog, and each keeps its case, without taking room in it, for put_bottles_back. A bottle drunk is marked with mark_bottles_drunk. Also undoes mark_bottles_drunk made by mistake for a bottle no longer in the cellar: it loses its consumed date. All or none.",
            inputSchema: z.strictObject({ bottleIds }),
            annotations: changes(true)
        },
        ({ bottleIds }) => answerWrite('take_bottles_out', access, () => takeOut(bottleIds))
    );

    server.registerTool(
        'put_bottles_back',
        {
            title: 'Put bottles back in the cellar',
            description:
                'Puts bottles back in the cellar (available): those taken out with take_bottles_out, or marked drunk by mistake, which lose their consumed date. caseId puts them in that case; left out, each goes back to the case it was taken out of. A bottle that was drunk has no case left: give caseId for it, or it is back in the cellar without a place. All or none: a case without room for them takes none. move_bottles moves bottles already in the cellar.',
            inputSchema: z.strictObject({
                bottleIds,
                caseId: optionalId.describe('The id of the case, from get_free_space.')
            }),
            annotations: changes(true)
        },
        ({ bottleIds, caseId }) =>
            answerWrite('put_bottles_back', access, () => putBack(bottleIds, caseId))
    );

    server.registerTool(
        'update_wish',
        {
            title: 'Change a wish',
            description:
                'Changes how many bottles to buy, or the note, of a wish of the wishlist; its wine or text stays. Answers the wish as get_wishlist does.',
            inputSchema: z
                .strictObject({
                    wishId: id.describe('The id of the wish, from get_wishlist.'),
                    quantity: wishSchema.shape.quantity.describe(
                        'How many bottles to buy: null removes it.'
                    ),
                    note: wishSchema.shape.note.describe(
                        'The note, in place of the old one: null removes it.'
                    )
                })
                .partial()
                .required({ wishId: true })
                .refine(changesSomething, 'Give quantity, note or both'),
            annotations: changes(true)
        },
        ({ wishId, ...changes }) =>
            answerWrite('update_wish', access, () => editWish(wishId, changes))
    );

    server.registerTool(
        'delete_bottles',
        {
            title: 'Delete bottles',
            description:
                'Deletes bottles for good, such as bottles added by mistake: this cannot be undone, and they leave the history and the statistics. A bottle drunk is marked with mark_bottles_drunk, and one taken away with take_bottles_out: that is usually what the owner means. Ask the owner first. All or none.',
            inputSchema: z.strictObject({ bottleIds }),
            annotations: changes(true)
        },
        ({ bottleIds }) => answerWrite('delete_bottles', access, () => deleteBottles(bottleIds))
    );

    return server;
}

/**
 * Answers the requests to /mcp, without sessions: a new server for each request, which serves the
 * 2026-07-28 revision of the protocol and the earlier ones. The SDK reports some of the requests it
 * refuses, such as a malformed one: they are the client's errors, logged with DEBUG=mcp only.
 */
const mcpHandler = createMcpHandler(createServer, { onerror: debugLogger('mcp') });

/**
 * Answers a request to /mcp with what its token allows. The SDK hands `authInfo` to the server of
 * the request; the token itself stays out of it, so that nothing the SDK reports can show it.
 */
export function serveMcp(request: Request, access: McpAccess): Promise<Response> {
    const authInfo: AuthInfo = { token: '', clientId: 'cellar', scopes: [], extra: { ...access } };
    return mcpHandler.fetch(request, { authInfo });
}
