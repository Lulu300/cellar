import { readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { createSession } from '#lib/server/session.js';
import { fakeCookies, fakeEvent } from '../../../../test/event';
import { POST as importJson } from '../import-json/+server';
import { POST as restore } from './+server';

// Hoisted with vi.mock, which runs before the imports.
const { LIMIT } = vi.hoisted(() => ({ LIMIT: 64 * 1024 }));

vi.mock('#lib/server/zip.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('#lib/server/zip.js')>()),
    MAX_ZIP_UPLOAD_BYTES: LIMIT
}));

/** A zip upload of `chunks` chunks of 16 KB, which counts the chunks read. */
function upload(chunks: number) {
    const sent = { chunks: 0 };
    const chunk = new Uint8Array(16 * 1024).fill(1);
    const body = new ReadableStream<Uint8Array>(
        {
            pull(controller) {
                if (sent.chunks === chunks) return controller.close();
                sent.chunks += 1;
                controller.enqueue(chunk);
            }
            // Nothing is read before the route asks.
        },
        { highWaterMark: 0 }
    );
    return { body, sent };
}

// The event of either route, which the two handlers both take.
type Event = Parameters<typeof restore>[0] & Parameters<typeof importJson>[0];

const routes = [
    ['/api/admin/restore', restore],
    ['/api/admin/import-json', importJson]
] as const;

const countryNames = async () => (await db.select().from(countries)).map(({ name }) => name);
const leftFiles = () => readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'));

describe.each(routes)('POST %s with a zip upload over the limit', (path, POST) => {
    beforeAll(async () => {
        const now = new Date();
        await db
            .insert(countries)
            .values({ id: 'es', name: 'Spain', createdAt: now, updatedAt: now })
            .onConflictDoNothing();
    });

    const send = async (body: ReadableStream<Uint8Array>, headers: Record<string, string>) =>
        POST(
            fakeEvent<Event>({
                method: 'POST',
                path,
                routeId: path,
                body,
                headers: { 'content-type': 'application/zip', ...headers },
                session: await createSession(fakeCookies(), new URL('http://localhost'))
            })
        );

    it('answers 413 from its Content-Length, before reading it', async () => {
        const { body, sent } = upload(LIMIT / 1024);

        const response = await send(body, { 'content-length': String(LIMIT + 1) });

        expect(response.status).toBe(413);
        expect((await response.json()).error.code).toBe('body_too_large');
        expect(sent.chunks).toBe(0);
        expect(await countryNames()).toEqual(['Spain']);
        expect(leftFiles()).toEqual([]);
    });

    it('answers 413 to an upload without Content-Length once it passes the limit, and removes what it wrote', async () => {
        const { body, sent } = upload(1000);

        const response = await send(body, {});

        expect(response.status).toBe(413);
        expect((await response.json()).error.code).toBe('body_too_large');
        // Stopped at the limit, not read to the end.
        expect(sent.chunks).toBeLessThan(10);
        expect(await countryNames()).toEqual(['Spain']);
        expect(leftFiles()).toEqual([]);
    });
});
