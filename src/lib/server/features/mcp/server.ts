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
import {
    addBottles,
    addWine,
    bottlesByBarcode,
    changeBottleNotes,
    choices,
    freeSpace,
    markDrunk,
    MAX_APPELLATIONS,
    moveBottles,
    rateWine,
    searchAppellations,
    searchWines,
    wineShortages,
    wineWithBottles
} from './service';
import { assertMcpWrite, ReadOnlyTokenError, type McpAccess } from './token';

/** The most wines that one search returns. */
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
        if (refusal) return { isError: true, content: [{ type: 'text', text: refusal.message }] };
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

/** The bottles of a write tool, by the ids that get_wine and find_bottle_by_barcode give. */
const bottleIds = bulkBottleChangesSchema.shape.ids.describe(
    'The ids of the bottles, as get_wine or find_bottle_by_barcode give them.'
);

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
                limit: z
                    .int()
                    .min(1)
                    .max(MAX_SEARCH_LIMIT)
                    .default(50)
                    .describe('The most wines to return.')
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
        'get_free_space',
        {
            title: 'Free space in storage',
            description:
                'The room left (free) in each case of each storage container, in bottles, with the totals: a case holds its capacity in bottles in the cellar. The id of a case is what add_bottles and move_bottles take.',
            annotations: READ_ONLY
        },
        () => answer('get_free_space', freeSpace)
    );

    server.registerTool(
        'list_choices',
        {
            title: 'Lists to choose from',
            description:
                'The id and name of each bottle format, wine color, wine type, classification and origin (where bottles were bought), for the ids that add_wine and add_bottles take. search_appellations gives the appellations.',
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
                'Adds bottles of a wine to the cellar, all alike, each with its own id and, when Cellar numbers them, its own barcode. All or none: a case without room for them adds none.',
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
