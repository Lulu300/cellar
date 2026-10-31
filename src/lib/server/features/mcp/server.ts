import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { debugLogger } from '#lib/server/debug.js';
import { getStatistics } from '#lib/server/features/bottles/service.js';
import { ApiError } from '#lib/server/http/errors.js';
import { BARCODE_MAX_LENGTH } from '#lib/shared/schemas/bottle.js';
import { id, NAME_MAX_LENGTH } from '#lib/shared/schemas/common.js';
import {
    bottlesByBarcode,
    freeSpace,
    searchWines,
    wineShortages,
    wineWithBottles
} from './service';

/** The most wines that one search returns. */
const MAX_SEARCH_LIMIT = 200;

const INSTRUCTIONS = `Cellar manages a home wine cellar. A wine (name, producer, appellation, color…) has bottles; each bottle is "available" (in the cellar, in a case of a storage container), "out_of_cellar" (taken out, not drunk yet) or "consumed" (drunk). "optimum" is the year a bottle is at its best. Prices are in the currency of the cellar's owner. A field left out of an answer is empty.`;

/** Every tool here only reads: the client may call it without asking. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

/** Leaves the empty fields out of an answer: an assistant reads every one of them. */
const withoutNulls = (_key: string, value: unknown) => (value === null ? undefined : value);

/**
 * The answer of a tool: what `read` returns as JSON, or the error to show the assistant. An error
 * of the API, such as an unknown wine, says what went wrong; any other is logged and stays here.
 */
async function answer(tool: string, read: () => unknown): Promise<CallToolResult> {
    try {
        const text = JSON.stringify(await read(), withoutNulls);
        return { content: [{ type: 'text', text }] };
    } catch (error) {
        if (error instanceof ApiError) {
            return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
        console.error(`MCP tool ${tool} failed:`, error);
        return { isError: true, content: [{ type: 'text', text: 'Internal server error' }] };
    }
}

/** The MCP server of one request, with the read tools. */
function createServer(): McpServer {
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
                'The room left (free) in each case of each storage container, in bottles, with the totals: a case holds its capacity in bottles in the cellar.',
            annotations: READ_ONLY
        },
        () => answer('get_free_space', freeSpace)
    );

    return server;
}

/**
 * Answers the requests to /mcp, without sessions: a new server for each request, which serves the
 * 2026-07-28 revision of the protocol and the earlier ones. The SDK reports some of the requests it
 * refuses, such as a malformed one: they are the client's errors, logged with DEBUG=mcp only.
 */
export const mcpHandler = createMcpHandler(createServer, { onerror: debugLogger('mcp') });
