import { inspect } from 'node:util';
import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
    deleteBottlesById,
    listBottlesWithDefinitions
} from '#lib/server/features/bottles/service.js';
import type { McpAccess } from '#lib/server/features/mcp/token.js';
import { createContainer, storageOverview } from '#lib/server/features/storage/service.js';
import { createWish, removeWish } from '#lib/server/features/wishlist/service.js';
import { holdWrites } from '#lib/server/write-gate.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';
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
            ['list_bottles', true],
            ['get_wine_shortage', true],
            ['get_wishlist', true],
            ['get_free_space', true],
            ['list_choices', true],
            ['search_appellations', true],
            ['add_wine', false],
            ['add_bottles', false],
            ['add_wish', false],
            ['remove_wish', false],
            ['mark_bottles_drunk', false],
            ['move_bottles', false],
            ['update_bottle_notes', false],
            ['rate_wine', false],
            ['update_wine', false],
            ['update_bottles', false],
            ['take_bottles_out', false],
            ['put_bottles_back', false],
            ['update_wish', false],
            ['delete_bottles', false]
        ]);
    });

    // An assistant reads nothing else to know what a tool does and what to give it (FEAT-12).
    it('describes the server, each tool and each parameter of a tool', async () => {
        const initialized = await legacy('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
        });
        expect(initialized.result.instructions).toContain('formerLocation');

        const { result } = await legacy('tools/list');
        type Tool = {
            name: string;
            description?: string;
            inputSchema: { properties?: Record<string, { description?: string }> };
        };
        const undescribed = (result.tools as Tool[]).flatMap(
            ({ name, description, inputSchema }) => [
                ...(description ? [] : [name]),
                ...Object.entries(inputSchema.properties ?? {})
                    .filter(([, property]) => !property.description)
                    .map(([parameter]) => `${name}.${parameter}`)
            ]
        );
        expect(undescribed).toEqual([]);
    });

    it('reads a list past its first page with offset', async () => {
        const page = async (offset: number) =>
            JSON.parse(
                (await modernCall('search_wines', { limit: 1, offset })).result.content[0].text
            );

        expect(await page(0)).toMatchObject({ total: 1, wines: [{ id: margaux }] });
        expect(await page(1)).toEqual({ total: 1, wines: [] });
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

    it('lists what was drunk in a month, from the days an assistant gives', async () => {
        const drunk = (id: string, day: string) => ({
            id,
            availability: 'consumed' as const,
            consumedDate: new Date(day)
        });
        const rows = [
            drunk('october-31', '2026-10-31T22:30:00Z'),
            drunk('november-1', '2026-11-01'),
            drunk('november-30', '2026-11-30T21:00:00Z'),
            drunk('december-1', '2026-12-01')
        ];
        await insertBottles(margaux, rows);
        // The tests of the write tools count the bottles of the wine.
        onTestFinished(() => {
            deleteBottlesById(rows.map(({ id }) => id));
        });

        const { result } = await modernCall('list_bottles', {
            availability: 'consumed',
            consumedFrom: '2026-11-01',
            consumedTo: '2026-11-30'
        });

        const { total, bottles } = JSON.parse(result.content[0].text);
        expect(total).toBe(2);
        expect(bottles.map(({ id }: { id: string }) => id)).toEqual(['november-30', 'november-1']);
        expect(bottles[0]).toMatchObject({
            consumedDate: '2026-11-30',
            wine: { id: margaux, name: 'Château Margaux' }
        });
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
        await modernCall('rate_wine', { wineId: 'nothing', rating: 2 }, WRITE);
        await modernCall('rate_wine', { wineId: margaux, rating: 2 });
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
        /**
         * One call of each write tool, on the bottle `bottle`, the case `caseId` and the wish `wish`;
         * delete_bottles deletes the bottle `spare`.
         */
        const writes = (
            bottle: string,
            caseId: string,
            wish: string,
            spare: string
        ): [string, object][] => [
            [
                'add_wine',
                { name: 'Pavillon Rouge', appellationId: 'mgx', typeId: 'still', colorId: 'red' }
            ],
            ['add_bottles', { wineId: margaux, formatId: 'bottle', quantity: 2, vintage: 2020 }],
            ['add_wish', { text: 'Clos Rougeard', quantity: 2, note: 'For the wedding' }],
            ['update_wish', { wishId: wish, quantity: 3 }],
            ['remove_wish', { wishId: wish }],
            ['mark_bottles_drunk', { bottleIds: [bottle], note: 'With friends' }],
            ['move_bottles', { bottleIds: [bottle], caseId }],
            ['update_bottle_notes', { bottleIds: [bottle], addedNote: 'Corked' }],
            ['rate_wine', { wineId: margaux, rating: 2 }],
            ['update_wine', { wineId: margaux, targetQuantity: 6 }],
            ['update_bottles', { bottleIds: [bottle], purchasePrice: 52 }],
            ['take_bottles_out', { bottleIds: [bottle] }],
            ['put_bottles_back', { bottleIds: [bottle], caseId }],
            ['delete_bottles', { bottleIds: [spare] }]
        ];

        /** The text of a tool's answer, and whether it is an error. */
        const textOf = ({ result }: { result: CallResult }) => [
            result.isError,
            result.content[0].text
        ];
        type CallResult = { isError?: boolean; content: { text: string }[] };

        it('refuses each one to a read-only token, saying where to allow it, and writes nothing', async () => {
            const before = listBottlesWithDefinitions();

            for (const [name, args] of writes('none', 'none', 'none', 'none')) {
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
            await insertBottles(margaux, [{ id: 'spare' }]);

            const wish = createWish(wishSchema.parse({ text: 'Bought already' }));
            for (const [name, args] of writes(bottle.id, cases[0].id, wish.id, 'spare')) {
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
            expect(bottles.map(({ id }) => id)).not.toContain('spare');
            // Drunk, moved, taken out, then put back in the case: no longer drunk.
            expect(bottles.find(({ id }) => id === bottle.id)).toMatchObject({
                availability: 'available',
                storageCaseId: cases[0].id,
                consumedDate: null,
                purchasePrice: 52,
                notes: 'With friends\nCorked'
            });
            const { result } = await modernCall('get_wishlist', {});
            expect(JSON.parse(result.content[0].text)).toEqual([
                {
                    id: expect.any(String),
                    text: 'Clos Rougeard',
                    quantity: 2,
                    note: 'For the wedding'
                }
            ]);
        });

        it('changes only the fields given, leaving out those a tool may clear with null', async () => {
            const [bottle] = listBottlesWithDefinitions(margaux);
            const wish = createWish(wishSchema.parse({ text: 'Clos Rougeard', note: 'Saumur' }));
            const call = async (name: string, args: object) =>
                JSON.parse((await modernCall(name, args, WRITE)).result.content[0].text);

            await call('update_wine', { wineId: margaux, description: 'Grand vin', website: null });
            await call('update_bottles', { bottleIds: [bottle.id], purchaseDate: '2026-10-01' });

            expect(await call('update_wine', { wineId: margaux, targetQuantity: 6 })).toMatchObject(
                {
                    description: 'Grand vin',
                    targetQuantity: 6
                }
            );
            expect(
                await call('update_bottles', { bottleIds: [bottle.id], purchasePrice: 52 })
            ).toEqual([
                expect.objectContaining({
                    purchaseDate: '2026-10-01',
                    purchasePrice: 52,
                    barcode: 'CV0001',
                    vintage: 2015
                })
            ]);
            expect(await call('update_wish', { wishId: wish.id, quantity: 2 })).toEqual({
                id: wish.id,
                text: 'Clos Rougeard',
                quantity: 2,
                note: 'Saumur'
            });
            expect(
                await call('update_wine', { wineId: margaux, description: null })
            ).not.toHaveProperty('description');
        });

        it('says why the cellar refuses a write, without logging it', async () => {
            const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

            const missing = await modernCall(
                'add_bottles',
                { wineId: margaux, formatId: 'magnum' },
                WRITE
            );
            const unknown = await modernCall('mark_bottles_drunk', { bottleIds: ['gone'] }, WRITE);

            const [bottle] = listBottlesWithDefinitions(margaux);
            await insertBottles(margaux, [{ id: 'other' }]);
            const taken = await modernCall(
                'update_bottles',
                { bottleIds: ['other'], barcode: bottle.barcode },
                WRITE
            );
            const shared = await modernCall(
                'update_bottles',
                { bottleIds: [bottle.id, 'other'], barcode: 'CV0002' },
                WRITE
            );
            const deleted = await modernCall(
                'delete_bottles',
                { bottleIds: ['other', 'gone'] },
                WRITE
            );

            expect(textOf(missing)).toEqual([
                true,
                'An entry it refers to does not exist (formatId magnum)\nDetails: [{"field":"formatId","id":"magnum"}]'
            ]);
            expect(textOf(unknown)).toEqual([
                true,
                'No bottle with the id gone\nDetails: {"ids":["gone"]}'
            ]);
            expect(textOf(taken)).toEqual([
                true,
                'This barcode is already assigned to another bottle'
            ]);
            expect(textOf(shared)).toEqual([
                true,
                'A barcode can only be given to a single bottle'
            ]);
            expect(textOf(deleted)).toEqual([
                true,
                'No bottle with the id gone\nDetails: {"ids":["gone"]}'
            ]);
            expect(listBottlesWithDefinitions(margaux).map(({ id }) => id)).toContain('other');
            expect(errors).not.toHaveBeenCalled();
            errors.mockRestore();
        });

        // FEAT-12: the message names a few, the details all of them, for the assistant to act on.
        it('gives the details of a refusal after its message: every bottle and wish in cause', async () => {
            const detailsOf = ({ result }: { result: CallResult }) => {
                expect(result.isError).toBe(true);
                const [message, details, ...rest] = result.content[0].text.split('\n');
                expect(rest).toEqual([]);
                expect(details.startsWith('Details: ')).toBe(true);
                return [message, JSON.parse(details.slice('Details: '.length))];
            };
            const [bottle] = listBottlesWithDefinitions(margaux);

            const missing = Array.from({ length: 12 }, (_, i) => `missing-${i + 1}`);
            expect(
                detailsOf(
                    await modernCall(
                        'take_bottles_out',
                        { bottleIds: [bottle.id, ...missing] },
                        WRITE
                    )
                )
            ).toEqual([
                'No bottle with the id missing-1, missing-2, missing-3, missing-4, missing-5, missing-6, missing-7, missing-8, missing-9, missing-10 and 2 more',
                { ids: missing }
            ]);

            await modernCall(
                'update_bottle_notes',
                { bottleIds: [bottle.id], notes: 'x'.repeat(4_990) },
                WRITE
            );
            expect(
                detailsOf(
                    await modernCall(
                        'mark_bottles_drunk',
                        { bottleIds: [bottle.id], note: 'A long dinner' },
                        WRITE
                    )
                )
            ).toEqual([
                'The note does not fit after the notes of 1 bottle(s): notes hold 5000 characters at most',
                { ids: [bottle.id], bottles: 1, maximum: 5_000 }
            ]);

            const wish = createWish(wishSchema.parse({ definitionId: margaux }));
            onTestFinished(() => {
                removeWish(wish.id);
            });
            expect(
                detailsOf(await modernCall('add_wish', { wineId: margaux, quantity: 2 }, WRITE))
            ).toEqual(['This wine is already on the wishlist', { wishId: wish.id }]);
            await modernCall('update_bottle_notes', { bottleIds: [bottle.id], notes: null }, WRITE);
        });

        // FEAT-13: which id is unknown, and the id of a full case, for the assistant to act on.
        it('names an unknown reference, and the case that has no room', async () => {
            const detailsOf = ({ result }: { result: CallResult }) => {
                expect(result.isError).toBe(true);
                const [, details] = result.content[0].text.split('\nDetails: ');
                return JSON.parse(details);
            };
            const purchase = { wineId: margaux, formatId: 'bottle', quantity: 1 };
            const [bottle] = listBottlesWithDefinitions(margaux);

            expect(
                detailsOf(
                    await modernCall(
                        'add_bottles',
                        { ...purchase, formatId: 'nebuchadnezzar' },
                        WRITE
                    )
                )
            ).toEqual([{ field: 'formatId', id: 'nebuchadnezzar' }]);
            expect(
                detailsOf(
                    await modernCall('add_bottles', { ...purchase, originId: 'market' }, WRITE)
                )
            ).toEqual([{ field: 'originId', id: 'market' }]);
            // Named as the tools name them, not as the API does (definitionId, storageCaseId).
            const misnamed = await modernCall(
                'add_bottles',
                { ...purchase, wineId: 'no-wine', caseId: 'no-case' },
                WRITE
            );
            expect(textOf(misnamed)).toEqual([
                true,
                'An entry it refers to does not exist (wineId no-wine, caseId no-case)\nDetails: [{"field":"wineId","id":"no-wine"},{"field":"caseId","id":"no-case"}]'
            ]);
            expect(
                detailsOf(
                    await modernCall(
                        'move_bottles',
                        { bottleIds: [bottle.id], caseId: 'no-case' },
                        WRITE
                    )
                )
            ).toEqual([{ field: 'caseId', id: 'no-case' }]);
            expect(
                detailsOf(await modernCall('add_wish', { wineId: 'no-wine', quantity: 1 }, WRITE))
            ).toEqual([{ field: 'wineId', id: 'no-wine' }]);

            const { cases } = createContainer({ name: 'Tiny', cases: ['1'], caseCapacities: [1] });
            await insertBottles(margaux, [{ id: 'resident', storageCaseId: cases[0].id }]);
            expect(
                detailsOf(
                    await modernCall(
                        'move_bottles',
                        { bottleIds: [bottle.id], caseId: cases[0].id },
                        WRITE
                    )
                )
            ).toEqual({ caseId: cases[0].id, caseName: 'Tiny1', capacity: 1, bottles: 2 });
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
                ['add_wine', { name: ' ', appellationId: 'mgx', typeId: 'still', colorId: 'red' }],
                ['add_wish', { wineId: margaux, text: 'Margaux' }],
                ['add_wish', { quantity: 2 }],
                ['add_wish', { text: 'Clos Rougeard', quantity: 0 }],
                ['update_wine', { wineId: margaux }],
                ['update_wine', { wineId: margaux, name: ' ' }],
                ['update_wine', { wineId: margaux, colorId: null }],
                ['update_wine', { wineId: margaux, website: 'not a site' }],
                ['update_bottles', { bottleIds: ['a'] }],
                ['update_bottles', { bottleIds: ['a'], purchasePrice: -1 }],
                ['take_bottles_out', { bottleIds: [] }],
                ['put_bottles_back', { bottleIds: [] }],
                ['update_wish', { wishId: 'a' }],
                ['update_wish', { wishId: 'a', quantity: 0 }],
                ['delete_bottles', { bottleIds: [] }],
                ['list_bottles', { availability: 'drunk' }],
                ['list_bottles', { consumedFrom: 'last month' }]
            ] as const) {
                const { result } = await modernCall(name, args, WRITE);
                expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
            }
            expect(listBottlesWithDefinitions()).toEqual(before);
        });

        it('refuses an argument that a write tool does not know, rather than write without it', async () => {
            const ratingOf = async () =>
                JSON.parse(
                    (await modernCall('get_wine', { wineId: margaux })).result.content[0].text
                ).rating;
            await modernCall('rate_wine', { wineId: margaux, rating: 4.5 }, WRITE);
            const before = listBottlesWithDefinitions();

            for (const [name, args] of [
                ['rate_wine', { wineId: margaux, score: 5 }],
                ['add_bottles', { wineId: margaux, formatId: 'bottle', storageCaseId: 'x' }],
                ['mark_bottles_drunk', { bottleIds: [before[0].id], notes: 'Typo' }],
                ['update_wine', { wineId: margaux, targetQuantity: 3, rating: 1 }],
                ['update_bottles', { bottleIds: [before[0].id], purchasePrice: 1, notes: 'Typo' }],
                ['take_bottles_out', { bottleIds: [before[0].id], caseId: 'x' }],
                ['put_bottles_back', { bottleIds: [before[0].id], storageCaseId: 'x' }],
                ['update_wish', { wishId: 'x', quantity: 2, text: 'Typo' }],
                ['delete_bottles', { bottleIds: [before[0].id], force: true }],
                ['list_bottles', { status: 'consumed' }]
            ] as const) {
                const { result } = await modernCall(name, args, WRITE);
                expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
            }
            expect(await ratingOf()).toBe(4.5);
            expect(listBottlesWithDefinitions()).toEqual(before);

            const { result } = await legacy('tools/list');
            for (const tool of result.tools.filter(
                (tool: { annotations: { readOnlyHint: boolean } }) => !tool.annotations.readOnlyHint
            ))
                expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
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
