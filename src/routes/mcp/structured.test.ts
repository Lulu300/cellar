import {
    Client,
    StreamableHTTPClientTransport,
    type CallToolResult,
    type jsonSchemaValidator,
    type VersionNegotiationMode
} from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { origins } from '#lib/server/db/schema.js';
import { seed } from '#lib/server/db/seed.js';
import { serveMcp } from '#lib/server/features/mcp/server.js';
import type { McpAccess } from '#lib/server/features/mcp/token.js';
import { createContainer } from '#lib/server/features/storage/service.js';

// The SDK's own client calls every tool of /mcp in this process, as an assistant would over HTTP,
// on the two families of revisions that the server serves. It validates the structured content of
// each answer against the outputSchema that tools/list declares, with its own validator (ajv), not
// with the zod schemas of the server: what a client checks is what the test checks.

/** The client's own validator, counting the answers it validated. */
class CountingValidator implements jsonSchemaValidator {
    private readonly ajv = new AjvJsonSchemaValidator();
    validated = 0;

    getValidator<T>(schema: Parameters<jsonSchemaValidator['getValidator']>[0]) {
        const validate = this.ajv.getValidator<T>(schema);
        return (input: unknown) => {
            this.validated += 1;
            return validate(input);
        };
    }
}

/** A client of /mcp with `access`, connected on `mode`, and the revisions its calls named. */
async function connect(mode: VersionNegotiationMode, access: McpAccess) {
    const revisions = new Set<string>();
    const validator = new CountingValidator();
    const fetch = async (url: string | URL, init?: RequestInit) => {
        const request = new Request(url, init);
        const revision = request.headers.get('mcp-protocol-version');
        if (revision) revisions.add(revision);
        // As the route does: every message is a POST.
        if (request.method !== 'POST') return new Response(null, { status: 405 });
        return serveMcp(request, access);
    };
    const client = new Client(
        { name: 'structured-test', version: '1.0.0' },
        { versionNegotiation: { mode }, jsonSchemaValidator: validator }
    );
    await client.connect(
        new StreamableHTTPClientTransport(new URL('http://cellar.test/mcp'), { fetch })
    );
    return { client, revisions, validator };
}

/**
 * The objects of a JSON Schema that may leave out a field or hold one more, by their path: every
 * field of an answer is there, null when empty, and no other.
 */
function looseObjects(schema: unknown, path = ''): string[] {
    if (!schema || typeof schema !== 'object') return [];
    const node = schema as { type?: unknown; properties?: object; required?: string[] };
    const fields = Object.keys(node.properties ?? {});
    const loose =
        node.type === 'object' &&
        ((schema as { additionalProperties?: unknown }).additionalProperties !== false ||
            fields.some((field) => !node.required?.includes(field)));
    return [
        ...(loose ? [path || '/'] : []),
        ...Object.entries(schema).flatMap(([key, value]) => looseObjects(value, `${path}/${key}`))
    ];
}

/** What the text of an answer holds: its structured content without the empty fields. */
const withoutNulls = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_key, field) => (field === null ? undefined : field)));

const thisYear = new Date().getFullYear();

beforeAll(() => {
    seed(db);
    db.insert(origins).values({ id: 'shop', name: 'Made-up wine shop' }).run();
});

describe.each([
    ['2026-07-28', { pin: '2026-07-28' } as const],
    ['2025 (legacy)', 'legacy' as const]
])('every tool on a %s client', (era, mode) => {
    it('answers structured content that its outputSchema declares, and the same JSON as text', async () => {
        const { client, revisions, validator } = await connect(mode, { write: true });
        const { tools } = await client.listTools();
        const answered = new Map<string, CallToolResult>();
        let calls = 0;

        /** Calls a tool, which must succeed, and returns its structured content. */
        const call = async (name: string, args: Record<string, unknown> = {}) => {
            const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
            expect(result.isError, `${name}: ${JSON.stringify(result.content)}`).toBeFalsy();
            answered.set(name, result);
            calls += 1;
            // The content of a 2025 client is the same: every answer is an object.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any tool's answer, which the client has validated against the schema it declares
            return result.structuredContent as Record<string, any>;
        };

        // A made-up cellar of this client's own, so that each run starts from the same state.
        const { cases } = createContainer({
            name: `Rack ${era}`,
            cases: ['1', '2'],
            caseCapacities: [12, 12]
        });
        const choices = await call('list_choices');
        const [color] = choices.colors;
        const [type] = choices.types;
        const [format] = choices.formats;
        const [classification] = choices.classifications;
        const region = choices.regions[0];
        const { appellations } = await call('search_appellations', { query: 'margaux' });
        await call('get_free_space');

        const producer = await call('create_producer', {
            name: `Domaine Imaginaire ${era}`,
            regionId: region.id,
            website: 'https://example.com',
            contact: 'A made-up address',
            description: 'A made-up estate.'
        });
        expect(producer.created).toBe(true);
        expect((await call('create_producer', { name: producer.name })).created).toBe(false);

        // One wine with every field, one with only those required.
        const full = await call('add_wine', {
            name: `Cuvée complète ${era}`,
            producerId: producer.id,
            appellationId: appellations[0].id,
            typeId: type.id,
            colorId: color.id,
            classificationId: classification.id,
            website: 'https://example.com/cuvee',
            description: 'Made-up tasting notes.',
            rating: 4.5,
            grapeVarieties: ['Merlot', 'Cabernet Sauvignon'],
            targetQuantity: 12
        });
        const bare = await call('add_wine', {
            name: `Cuvée nue ${era}`,
            appellationId: appellations[0].id,
            typeId: type.id,
            colorId: color.id
        });

        const { bottles: kept } = await call('add_bottles', {
            wineId: full.id,
            quantity: 3,
            formatId: format.id,
            vintage: 2015,
            optimum: thisYear - 1,
            drinkFrom: '2020',
            drinkBefore: `${thisYear}`,
            originId: 'shop',
            purchasePrice: 42.5,
            purchaseDate: '2024-05-01',
            caseId: cases[0].id,
            notes: 'Made-up notes.'
        });
        const { bottles: coded } = await call('add_bottles', {
            wineId: bare.id,
            quantity: 1,
            formatId: format.id,
            barcode: `CODE-${era}`
        });
        const [drunk, out, inCase] = kept.map((bottle: { id: string }) => bottle.id);

        await call('mark_bottles_drunk', { bottleIds: [drunk], note: 'A made-up dinner.' });
        await call('take_bottles_out', { bottleIds: [out] });
        await call('add_wish', { wineId: full.id, quantity: 2, note: 'For a made-up party.' });
        const wish = await call('add_wish', { text: `Un vin rêvé ${era}` });

        // The read tools, on bottles in a case, out of the cellar, drunk and without a place.
        const wine = await call('get_wine', { wineId: full.id });
        expect(wine.bottles.map((bottle: { id: string }) => bottle.id).sort()).toEqual(
            [inCase, out].sort()
        );
        expect(wine.consumed).toEqual([expect.objectContaining({ id: drunk, location: null })]);
        await call('search_wines', { query: era.slice(0, 4) });
        await call('list_producers', { query: 'imaginaire' });
        await call('get_producer', { producerId: producer.id });
        expect((await call('find_bottle_by_barcode', { barcode: `CODE-${era}` })).bottles).toEqual([
            expect.objectContaining({ id: coded[0].id, location: null })
        ]);
        await call('get_statistics');
        expect((await call('list_bottles', { limit: 200 })).total).toBeGreaterThan(0);
        expect((await call('list_bottles_to_drink')).total).toBeGreaterThan(0);
        expect((await call('get_wine_shortage')).wines).toContainEqual(
            expect.objectContaining({ id: full.id })
        );
        expect((await call('get_wishlist')).wishes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: wish.id, wine: null }),
                expect.objectContaining({
                    text: null,
                    wine: expect.objectContaining({ id: full.id })
                })
            ])
        );

        // The other write tools.
        await call('move_bottles', { bottleIds: [inCase], caseId: cases[1].id });
        await call('update_bottle_notes', { bottleIds: [inCase], addedNote: 'Made-up note.' });
        await call('rate_wine', { wineId: bare.id, rating: 3 });
        await call('update_wine', { wineId: bare.id, description: 'Now described.' });
        await call('update_producer', { producerId: producer.id, contact: null });
        const { bottles: valued } = await call('update_bottles', {
            bottleIds: [inCase],
            currentValue: 60,
            currentValueDate: '2026-01-15'
        });
        expect(valued[0]).toMatchObject({ currentValue: 60, currentValueDate: '2026-01-15' });
        await call('put_bottles_back', { bottleIds: [out] });
        await call('update_wish', { wishId: wish.id, quantity: 6 });
        await call('remove_wish', { wishId: wish.id });
        await call('delete_bottles', { bottleIds: [coded[0].id] });

        expect(revisions).toEqual(new Set([era.startsWith('2026') ? '2026-07-28' : '2025-11-25']));
        // Every tool declares its answer, and was called: the client validated each answer.
        expect(tools.filter((tool) => tool.outputSchema?.type !== 'object')).toEqual([]);
        expect([...answered.keys()].sort()).toEqual(tools.map((tool) => tool.name).sort());
        expect(validator.validated).toBe(calls);
        expect(tools.flatMap((tool) => looseObjects(tool.outputSchema, tool.name))).toEqual([]);

        // The text is the structured content, but for the empty fields, which it leaves out.
        for (const [name, result] of answered) {
            const [content] = result.content;
            expect(content.type, name).toBe('text');
            expect(JSON.parse((content as { text: string }).text), name).toEqual(
                withoutNulls(result.structuredContent)
            );
        }
        await client.close();
    });

    it('answers a refusal as before, with its details and no structured content', async () => {
        const { client } = await connect(mode, { write: true });
        await client.listTools();

        const result = (await client.callTool({
            name: 'mark_bottles_drunk',
            arguments: { bottleIds: ['no-such-bottle'] }
        })) as CallToolResult;

        expect(result.structuredContent).toBeUndefined();
        expect(result).toMatchObject({
            isError: true,
            content: [
                {
                    type: 'text',
                    text: 'No bottle with the id no-such-bottle\nDetails: {"ids":["no-such-bottle"]}'
                }
            ]
        });
        await client.close();
    });

    it('still refuses a write to a read-only token', async () => {
        const { client } = await connect(mode, { write: false });
        await client.listTools();

        const result = (await client.callTool({
            name: 'rate_wine',
            arguments: { wineId: 'any', rating: 3 }
        })) as CallToolResult;

        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
        expect(result.content).toEqual([
            expect.objectContaining({ text: expect.stringContaining('read-only') })
        ]);
        await client.close();
    });
});
