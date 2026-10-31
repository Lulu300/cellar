import { inspect } from 'node:util';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { listBottlesWithDefinitions } from '#lib/server/features/bottles/service.js';
import type { McpAccess } from '#lib/server/features/mcp/token.js';
import { createContainer, storageOverview } from '#lib/server/features/storage/service.js';
import { holdWrites } from '#lib/server/write-gate.js';
import { fakeEvent } from '../../test/event';
import { insertBottles, insertWineDefinition } from '../../test/wine';
import { POST } from './+server';

// The errors that the SDK reports reach the logs, as with DEBUG=mcp in production: read when the
// MCP server module loads.
vi.hoisted(() => {
    process.env.DEBUG = 'mcp';
});

// One read can be made to fail as an unexpected error would.
vi.mock('#lib/server/features/storage/service.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/features/storage/service.js')>();
    return { ...module, storageOverview: vi.fn(module.storageOverview) };
});

const TOKEN = 'mcp-token-in-the-header';

const READ_ONLY: McpAccess = { write: false };
const WRITE: McpAccess = { write: true };

/** Posts one message to /mcp with the token, as the hook lets it through with `access`. */
async function post(body: unknown, headers: Record<string, string> = {}, access = READ_ONLY) {
    const event = fakeEvent<Parameters<typeof POST>[0]>({
        method: 'POST',
        path: '/mcp',
        routeId: '/mcp',
        body,
        headers: {
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${TOKEN}`,
            ...headers
        }
    });
    event.locals.mcpAccess = access;
    return POST(event);
}

/** The JSON-RPC message of an answer, sent as JSON or as the one event of a stream. */
async function messageOf(response: Response) {
    const text = await response.text();
    const data = text.startsWith('event:') ? text.split('\ndata: ')[1] : text;
    return JSON.parse(data);
}

/** A request of a 2025 client, once it has initialized: no session, so nothing ties them. */
const legacy = (method: string, params: object = {}, access = READ_ONLY) =>
    post(
        { jsonrpc: '2.0', id: 1, method, params },
        { 'mcp-protocol-version': '2025-06-18' },
        access
    ).then(messageOf);

/** A tools/call of a 2026-07-28 client, as the SDK's client sends it (recorded). */
function modernCall(name: string, args: object, access = READ_ONLY) {
    const meta = {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {}
    };
    return post(
        {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args, _meta: meta }
        },
        { 'mcp-method': 'tools/call', 'mcp-name': name, 'mcp-protocol-version': '2026-07-28' },
        access
    ).then(messageOf);
}

let margaux: string;

beforeAll(async () => {
    margaux = await insertWineDefinition();
    await insertBottles(margaux, [{ availability: 'available', vintage: 2015, barcode: 'CV0001' }]);
});

describe('POST /mcp', () => {
    it('opens to a 2025 client, which sees the read tools and the write tools', async () => {
        const initialized = await legacy('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
        });
        expect(initialized.result).toMatchObject({
            protocolVersion: '2025-06-18',
            serverInfo: { name: 'cellar' }
        });

        const { result } = await legacy('tools/list');
        const readOnly = (tool: { name: string; annotations: { readOnlyHint: boolean } }) => [
            tool.name,
            tool.annotations.readOnlyHint
        ];
        // The client asks before a write: the annotations tell it which tools change the cellar.
        expect(result.tools.map(readOnly)).toEqual([
            ['search_wines', true],
            ['get_wine', true],
            ['find_bottle_by_barcode', true],
            ['get_statistics', true],
            ['get_wine_shortage', true],
            ['get_free_space', true],
            ['list_choices', true],
            ['search_appellations', true],
            ['add_wine', false],
            ['add_bottles', false],
            ['mark_bottles_drunk', false],
            ['move_bottles', false],
            ['update_bottle_notes', false],
            ['rate_wine', false]
        ]);
    });

    it('answers a tool in plain JSON, without the empty fields', async () => {
        const { result } = await legacy('tools/call', {
            name: 'find_bottle_by_barcode',
            arguments: { barcode: 'cv0001' }
        });

        expect(result.isError).toBeUndefined();
        const [bottle] = JSON.parse(result.content[0].text);
        expect(bottle).toMatchObject({ vintage: 2015, wine: { name: 'Château Margaux' } });
        expect(bottle).not.toHaveProperty('notes');
    });

    it('answers a 2026-07-28 client too', async () => {
        const { result } = await modernCall('search_wines', { query: 'margaux' });

        expect(JSON.parse(result.content[0].text)).toMatchObject({
            total: 1,
            wines: [{ id: margaux, inCellar: 1, vintages: [2015] }]
        });
    });

    it('tells the assistant what went wrong for a known error, and logs an unexpected one', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const unknown = await legacy('tools/call', {
            name: 'get_wine',
            arguments: { wineId: 'nothing' }
        });
        expect(unknown.result).toEqual({
            isError: true,
            content: [{ type: 'text', text: 'Wine definition not found' }]
        });
        expect(errors).not.toHaveBeenCalled();

        vi.mocked(storageOverview).mockImplementationOnce(() => {
            throw new Error('SQLITE_CORRUPT: database disk image is malformed');
        });
        const failed = await legacy('tools/call', { name: 'get_free_space', arguments: {} });
        expect(failed.result).toEqual({
            isError: true,
            content: [{ type: 'text', text: 'Internal server error' }]
        });
        expect(errors).toHaveBeenCalledWith('MCP tool get_free_space failed:', expect.any(Error));
        errors.mockRestore();
    });

    it('refuses the arguments that the schema of the tool refuses', async () => {
        const { result } = await legacy('tools/call', {
            name: 'search_wines',
            arguments: { limit: 1000 }
        });

        expect(result.isError).toBe(true);
    });

    it('never writes the token to the logs, nor do the errors that the SDK reports', async () => {
        const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
            vi.spyOn(console, level).mockImplementation(() => {})
        );
        vi.mocked(storageOverview).mockImplementationOnce(() => {
            throw new Error('failed');
        });

        await legacy('tools/call', { name: 'get_free_space', arguments: {} });
        await modernCall('get_wine', { wineId: 'nothing' });
        // Requests that the SDK refuses and reports: a 2026-07-28 request without its envelope,
        // and one whose headers disagree with its body.
        const listTools = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
        await post(listTools, { 'mcp-protocol-version': '2026-07-28' });
        await post(listTools, { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call' });

        const debug = logs[4];
        expect(debug).toHaveBeenCalledWith('[mcp]', expect.any(Error));
        // As the console prints them: an error with its message, stack and cause.
        for (const log of logs)
            expect(inspect(log.mock.calls, { depth: null })).not.toContain(TOKEN);
        for (const log of logs) log.mockRestore();
    });

    describe('write tools', () => {
        /** One call of each write tool, on the bottle `bottle` and the case `caseId`. */
        const writes = (bottle: string, caseId: string): [string, object][] => [
            [
                'add_wine',
                { name: 'Pavillon Rouge', appellationId: 'mgx', typeId: 'still', colorId: 'red' }
            ],
            ['add_bottles', { wineId: margaux, formatId: 'bottle', quantity: 2, vintage: 2020 }],
            ['mark_bottles_drunk', { bottleIds: [bottle], note: 'With friends' }],
            ['move_bottles', { bottleIds: [bottle], caseId }],
            ['update_bottle_notes', { bottleIds: [bottle], addedNote: 'Corked' }],
            ['rate_wine', { wineId: margaux, rating: 2 }]
        ];

        /** The text of a tool's answer, and whether it is an error. */
        const textOf = ({ result }: { result: CallResult }) => [
            result.isError,
            result.content[0].text
        ];
        type CallResult = { isError?: boolean; content: { text: string }[] };

        it('refuses each one to a read-only token, saying where to allow it, and writes nothing', async () => {
            const before = listBottlesWithDefinitions();

            for (const [name, args] of writes('none', 'none')) {
                expect(textOf(await modernCall(name, args)), name).toEqual([
                    true,
                    'This MCP token is read-only: changes can be allowed in Cellar, under Admin › Settings › MCP access.'
                ]);
            }
            expect(listBottlesWithDefinitions()).toEqual(before);
            const { result } = await legacy('tools/call', { name: 'search_wines', arguments: {} });
            expect(JSON.parse(result.content[0].text).wines).toHaveLength(1);
        });

        it('runs each one for a token that may write, from a 2026-07-28 or a 2025 client', async () => {
            const { cases } = createContainer({ name: 'Shelf', cases: ['1'], caseCapacities: [6] });
            const [bottle] = listBottlesWithDefinitions(margaux);

            for (const [name, args] of writes(bottle.id, cases[0].id)) {
                const { result } = await modernCall(name, args, WRITE);
                expect(result.isError, `${name}: ${result.content[0].text}`).toBeUndefined();
            }
            const legacyCall = await legacy(
                'tools/call',
                { name: 'rate_wine', arguments: { wineId: margaux, rating: 4.5 } },
                WRITE
            );
            expect(JSON.parse(legacyCall.result.content[0].text)).toMatchObject({ rating: 4.5 });

            const bottles = listBottlesWithDefinitions(margaux);
            expect(bottles).toHaveLength(3);
            // Drunk, then moved: a drunk bottle stays out of any case.
            expect(bottles.find(({ id }) => id === bottle.id)).toMatchObject({
                availability: 'consumed',
                storageCaseId: null,
                notes: 'With friends\nCorked'
            });
        });

        it('says why the cellar refuses a write, without logging it', async () => {
            const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

            const missing = await modernCall(
                'add_bottles',
                { wineId: margaux, formatId: 'magnum' },
                WRITE
            );
            const unknown = await modernCall('mark_bottles_drunk', { bottleIds: ['gone'] }, WRITE);

            expect(textOf(missing)).toEqual([true, 'An entry it refers to does not exist']);
            expect(textOf(unknown)).toEqual([true, 'No bottle with the id gone']);
            expect(errors).not.toHaveBeenCalled();
            errors.mockRestore();
        });

        it('checks the arguments with the rules of the API', async () => {
            const before = listBottlesWithDefinitions();
            for (const [name, args] of [
                ['add_bottles', { wineId: margaux, formatId: 'bottle', quantity: 101 }],
                ['add_bottles', { wineId: margaux, formatId: 'bottle', purchasePrice: -1 }],
                ['rate_wine', { wineId: margaux, rating: 6 }],
                ['mark_bottles_drunk', { bottleIds: [] }],
                ['mark_bottles_drunk', { bottleIds: ['a'], date: 'yesterday' }],
                ['update_bottle_notes', { bottleIds: ['a'] }],
                ['add_wine', { name: ' ', appellationId: 'mgx', typeId: 'still', colorId: 'red' }]
            ] as const) {
                const { result } = await modernCall(name, args, WRITE);
                expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
            }
            expect(listBottlesWithDefinitions()).toEqual(before);
        });

        it('refuses a write while a restore, an import or a wipe holds them, and goes on reading', async () => {
            let release = () => {};
            const restore = holdWrites(() => new Promise<void>((resolve) => (release = resolve)));

            const write = await modernCall('rate_wine', { wineId: margaux, rating: 1 }, WRITE);
            const read = await modernCall('get_wine', { wineId: margaux });

            expect(textOf(write)).toEqual([
                true,
                'A restore, an import or a wipe is in progress. Try again in a moment.'
            ]);
            expect(read.result.isError).toBeUndefined();
            release();
            await restore;
        });
    });

    it('refuses a request that did not pass the token check of the hook', async () => {
        const event = fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/mcp',
            routeId: '/mcp',
            body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
        });

        expect(() => POST(event)).toThrow('The MCP server was reached without its token check');
    });
});
