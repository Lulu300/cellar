import { inspect } from 'node:util';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { storageOverview } from '#lib/server/features/storage/service.js';
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

/** Posts one message to /mcp with the token, as the hook lets it through. */
async function post(body: unknown, headers: Record<string, string> = {}) {
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
    event.locals.mcpAccess = { write: false };
    return POST(event);
}

/** The JSON-RPC message of an answer, sent as JSON or as the one event of a stream. */
async function messageOf(response: Response) {
    const text = await response.text();
    const data = text.startsWith('event:') ? text.split('\ndata: ')[1] : text;
    return JSON.parse(data);
}

/** A request of a 2025 client, once it has initialized: no session, so nothing ties them. */
const legacy = (method: string, params: object = {}) =>
    post({ jsonrpc: '2.0', id: 1, method, params }, { 'mcp-protocol-version': '2025-06-18' }).then(
        messageOf
    );

/** A tools/call of a 2026-07-28 client, as the SDK's client sends it (recorded). */
function modernCall(name: string, args: object) {
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
        { 'mcp-method': 'tools/call', 'mcp-name': name, 'mcp-protocol-version': '2026-07-28' }
    ).then(messageOf);
}

let margaux: string;

beforeAll(async () => {
    margaux = await insertWineDefinition();
    await insertBottles(margaux, [{ availability: 'available', vintage: 2015, barcode: 'CV0001' }]);
});

describe('POST /mcp', () => {
    it('opens to a 2025 client, which sees the read tools and no other', async () => {
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
        expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual([
            'search_wines',
            'get_wine',
            'find_bottle_by_barcode',
            'get_statistics',
            'get_wine_shortage',
            'get_free_space'
        ]);
        // Every one only reads: there is no write tool for a read-only token to reach.
        for (const tool of result.tools)
            expect(tool.annotations.readOnlyHint, tool.name).toBe(true);
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
