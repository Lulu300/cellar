import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Cookies } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, prepareDatabase } from '#lib/server/db/index.js';
import { appSettings } from '#lib/server/db/schema.js';
import { getAppSetting, setAppSetting } from '#lib/server/features/settings/repository.js';
import { reschedule } from '#lib/server/features/backup/scheduler.js';
import { createBackupToken } from '#lib/server/features/backup/token.js';
import {
    createMcpToken,
    revokeMcpToken,
    setMcpWriteAllowed
} from '#lib/server/features/mcp/token.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { APP_VERSION_KEY, UPGRADE_ACTIONS_KEY } from '#lib/server/upgrade.js';
import { holdWrites } from '#lib/server/write-gate.js';
import { createSession } from '#lib/server/session.js';
import { fakeCookies, fakeEvent } from './test/event';
import { handle, init } from './hooks.server';

// The schema is in place, as at any start after the first: init reads the version before the
// migrations, and records it after them.
vi.mock('#lib/server/db/index.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/db/index.js')>();
    module.migrateSchema(module.db);
    return { ...module, prepareDatabase: vi.fn() };
});

vi.mock('#lib/server/features/backup/scheduler.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('#lib/server/features/backup/scheduler.js')>()),
    reschedule: vi.fn()
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    db.delete(appSettings)
        .where(inArray(appSettings.key, [APP_VERSION_KEY, UPGRADE_ACTIONS_KEY]))
        .run();
});

/** Makes process.exit throw, so that init stops where the real exit would. */
function throwOnExit() {
    vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit ${code}`);
    });
}

describe('init', () => {
    it('stops the process when the database cannot be prepared', async () => {
        const failure = new Error(
            "Database migration failed, nothing was applied: Failed to run the query 'UPDATE `missing` SET `id` = 1;': no such table: missing"
        );
        vi.mocked(prepareDatabase).mockRejectedValueOnce(failure);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        throwOnExit();

        await expect(init()).rejects.toThrow('exit 1');

        expect(error).toHaveBeenCalledWith(expect.stringMatching(/cannot start/), failure);
    });

    it('prepares the database, then lets the server start', async () => {
        vi.mocked(prepareDatabase).mockImplementationOnce(async (afterMigrations) => {
            await afterMigrations?.();
        });
        const exit = vi.spyOn(process, 'exit');

        await init();

        expect(prepareDatabase).toHaveBeenCalled();
        expect(exit).not.toHaveBeenCalled();
        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(__APP_VERSION__);
    });

    it('keeps the version recorded after the migrations when a later step fails', async () => {
        vi.mocked(prepareDatabase).mockImplementationOnce(async (afterMigrations) => {
            await afterMigrations?.();
            throw new Error('The seeding failed');
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        throwOnExit();

        await expect(init()).rejects.toThrow('exit 1');

        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(__APP_VERSION__);
    });

    it('says that the upgrade check failed when it cannot read the recorded version', async () => {
        setAppSetting(APP_VERSION_KEY, 'not a version');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        throwOnExit();

        await expect(init()).rejects.toThrow('exit 1');

        expect(prepareDatabase).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith(
            '❌ Cellar cannot start: the upgrade check failed.',
            new Error('Invalid version "not a version": expected X.Y.Z or X.Y.Z-rc.N.')
        );
    });

    it('stops before the migrations on a database that a newer version used', async () => {
        setAppSetting(APP_VERSION_KEY, '99.0.0');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        throwOnExit();

        await expect(init()).rejects.toThrow('exit 1');

        expect(prepareDatabase).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith(
            `❌ Cellar ${__APP_VERSION__} cannot start: this database comes from 99.0.0, newer than this ${__APP_VERSION__}: start 99.0.0 again, or restore a backup made before the upgrade. No data was changed.`
        );
        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe('99.0.0');
    });

    it('removes what a stop left of backups and restores, and plans the automatic backups', async () => {
        vi.mocked(prepareDatabase).mockResolvedValueOnce();
        const partial = path.join(DATA_DIR, 'cellar-backup-2026-10-12T10-49-05-000.zip.partial');
        writeFileSync(partial, 'the start of a zip');
        const extractDir = path.join(DATA_DIR, 'temp-extract-2026-10-12T10-49-05-000');
        mkdirSync(extractDir);
        writeFileSync(path.join(extractDir, 'cellar.db'), 'an extracted database');

        await init();

        expect(existsSync(partial)).toBe(false);
        expect(existsSync(extractDir)).toBe(false);
        expect(reschedule).toHaveBeenCalled();
    });
});

/** Runs `handle` on a request, with a route that answers 200. */
function request(
    method: string,
    routeId: string,
    headers: Record<string, string> = {},
    cookies?: Cookies
) {
    const event = fakeEvent({ method, path: routeId, routeId, cookies });
    for (const [name, value] of Object.entries(headers)) event.request.headers.set(name, value);
    return handle({ event, resolve: async () => new Response('done') });
}

describe('handle', () => {
    it('lets the cron job back up with its token, and nothing else', async () => {
        const token = createBackupToken();
        const bearer = { authorization: `Bearer ${token}` };

        expect((await request('POST', '/api/admin/auto-backup', bearer)).status).toBe(200);
        expect((await request('POST', '/api/admin/auto-backup')).status).toBe(401);
        expect(
            (await request('POST', '/api/admin/auto-backup', { authorization: 'Bearer wrong' }))
                .status
        ).toBe(401);
        expect((await request('POST', '/api/admin/create-backup', bearer)).status).toBe(401);
        expect((await request('GET', '/api/admin/list-backups', bearer)).status).toBe(401);
        // The scheme is case-insensitive (RFC 9110); the token is not.
        expect(
            (await request('POST', '/api/admin/auto-backup', { authorization: `bearer ${token}` }))
                .status
        ).toBe(200);
        expect(
            (
                await request('POST', '/api/admin/auto-backup', {
                    authorization: `Bearer ${token.toUpperCase()}`
                })
            ).status
        ).toBe(401);
        // Replaced: the old token no longer works.
        createBackupToken();
        expect((await request('POST', '/api/admin/auto-backup', bearer)).status).toBe(401);
    });

    describe('the MCP server', () => {
        /** Sends a request to /mcp, and returns the answer and what the route received, if it ran. */
        async function callMcp(
            method: string,
            headers: Record<string, string> = {},
            cookies = fakeCookies()
        ) {
            const event = fakeEvent({ method, path: '/mcp', routeId: '/mcp', headers, cookies });
            let reached: App.Locals | undefined;
            const response = await handle({
                event,
                resolve: async (event) => {
                    reached = { ...event.locals };
                    return new Response('done');
                }
            });
            return { status: response.status, response, reached };
        }

        afterEach(() => {
            revokeMcpToken();
            setMcpWriteAllowed(false);
        });

        it('opens to its token only, whatever the method', async () => {
            const bearer = { authorization: `Bearer ${createMcpToken()}` };

            for (const method of ['GET', 'POST', 'DELETE']) {
                expect((await callMcp(method, bearer)).status, method).toBe(200);
                const refused = await callMcp(method);
                expect(refused.status, method).toBe(401);
                expect(refused.reached).toBeUndefined();
                expect(refused.response.headers.get('www-authenticate')).toBe('Bearer');
                expect(await refused.response.json()).toEqual({
                    error: { code: 'unauthenticated', message: 'A valid MCP token is required' }
                });
                expect((await callMcp(method, { authorization: 'Bearer wrong' })).status).toBe(401);
            }
            // The scheme is case-insensitive (RFC 9110); the token is not.
            expect(
                (await callMcp('POST', { authorization: bearer.authorization.toLowerCase() }))
                    .status
            ).toBe(401);
            expect(
                (
                    await callMcp('POST', {
                        authorization: bearer.authorization.replace('Bearer', 'bearer')
                    })
                ).status
            ).toBe(200);
        });

        it('refuses a session without the token, and hides the session from the route', async () => {
            const cookies = fakeCookies();
            await createSession(cookies, new URL('http://localhost'));
            expect((await callMcp('POST', {}, cookies)).status).toBe(401);

            const bearer = { authorization: `Bearer ${createMcpToken()}` };
            const { reached } = await callMcp('POST', bearer, cookies);
            expect(reached?.session).toBeNull();
        });

        it('refuses the token once revoked, or replaced by a new one', async () => {
            const first = { authorization: `Bearer ${createMcpToken()}` };
            const second = { authorization: `Bearer ${createMcpToken()}` };
            expect((await callMcp('POST', first)).status).toBe(401);
            expect((await callMcp('POST', second)).status).toBe(200);

            revokeMcpToken();
            expect((await callMcp('POST', second)).status).toBe(401);
        });

        it('tells the route whether the token may write: not until the admin allows it', async () => {
            const bearer = { authorization: `Bearer ${createMcpToken()}` };
            expect((await callMcp('POST', bearer)).reached?.mcpAccess).toEqual({ write: false });

            setMcpWriteAllowed(true);
            expect((await callMcp('POST', bearer)).reached?.mcpAccess).toEqual({ write: true });

            setMcpWriteAllowed(false);
            expect((await callMcp('POST', bearer)).reached?.mcpAccess).toEqual({ write: false });
        });

        it('opens nothing else with its token, and does not open to the backup token', async () => {
            const bearer = { authorization: `Bearer ${createMcpToken()}` };
            setMcpWriteAllowed(true);

            expect((await request('POST', '/api/bottles', bearer)).status).toBe(401);
            expect((await request('PATCH', '/api/bottles/[id]', bearer)).status).toBe(401);
            expect((await request('GET', '/api/admin/list-backups', bearer)).status).toBe(401);
            expect((await request('POST', '/api/admin/mcp-token', bearer)).status).toBe(401);
            expect((await request('POST', '/api/admin/auto-backup', bearer)).status).toBe(401);

            const backup = { authorization: `Bearer ${createBackupToken()}` };
            expect((await callMcp('POST', backup)).status).toBe(401);
        });

        it('keeps the origin check: a web page cannot use the token through a browser', async () => {
            const bearer = { authorization: `Bearer ${createMcpToken()}` };
            const crossSite = { ...bearer, origin: 'http://evil.example' };

            expect((await callMcp('POST', crossSite)).status).toBe(403);
            expect((await callMcp('POST', { ...bearer, origin: 'http://localhost' })).status).toBe(
                200
            );
        });

        it('never writes the token to the logs', async () => {
            const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
                vi.spyOn(console, level).mockImplementation(() => {})
            );
            const token = createMcpToken();

            await callMcp('POST', { authorization: `Bearer ${token}` });
            revokeMcpToken();
            await callMcp('POST', { authorization: `Bearer ${token}` });

            for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain(token);
        });
    });

    it('hands the route the body of the request untouched, never a copy', async () => {
        // A copy of the request tees its body: the branch that no one reads would keep every chunk
        // that the route reads, a whole upload in memory.
        const cookies = fakeCookies();
        await createSession(cookies, new URL('http://localhost'));
        const event = fakeEvent({
            method: 'POST',
            path: '/api/admin/restore',
            routeId: '/api/admin/restore',
            body: new Blob(['zip bytes'], { type: 'application/zip' }),
            cookies
        });
        const body = event.request.body;
        let received: ReadableStream | null = null;

        await handle({
            event,
            resolve: async (event) => {
                received = event.request.body;
                return new Response(null, { status: 204 });
            }
        });

        expect(received).toBe(body);
    });

    it('lets the restore, the JSON import and the wipe hold the writes, which they could not as a write', async () => {
        const cookies = fakeCookies();
        await createSession(cookies, new URL('http://localhost'));
        for (const routeId of [
            '/api/admin/restore',
            '/api/admin/import-json',
            '/api/admin/wipe-database'
        ]) {
            const event = fakeEvent({ method: 'POST', path: routeId, routeId, cookies });
            // Counted as a write under way, the route would wait for itself to end.
            const resolve = () => holdWrites(async () => new Response('held'));

            expect(await (await handle({ event, resolve })).text()).toBe('held');
        }
    });

    it('refuses writes while a restore holds them, and lets reads through', async () => {
        const cookies = fakeCookies();
        await createSession(cookies, new URL('http://localhost'));
        let release = () => {};
        const restore = holdWrites(() => new Promise<void>((resolve) => (release = resolve)));
        try {
            const write = await request('POST', '/api/bottles', {}, cookies);
            expect(write.status).toBe(503);
            expect(write.headers.get('retry-after')).toBe('10');
            expect((await request('GET', '/api/bottles', {}, cookies)).status).toBe(200);
        } finally {
            release();
            await restore;
        }
        expect((await request('POST', '/api/bottles', {}, cookies)).status).toBe(200);
    });

    it('tells caches that a page depends on the language cookie and the browser languages', async () => {
        // The middleware of Paraglide adds the headers that its strategy reads.
        const page = await handle({
            event: fakeEvent({ method: 'GET', path: '/wines', routeId: '/wines' }),
            resolve: async () =>
                new Response('<html></html>', {
                    headers: { 'content-type': 'text/html', vary: 'Accept-Encoding' }
                })
        });

        expect(page.headers.get('vary')).toBe('Accept-Encoding, Cookie, Accept-Language');
    });

    it('lets the browser keep an image whatever the cookie or the language', async () => {
        const image = await handle({
            event: fakeEvent({
                method: 'GET',
                path: '/uploads/wines/label.jpg',
                routeId: '/uploads/[...path]'
            }),
            resolve: async () =>
                new Response('jpeg', {
                    headers: {
                        'content-type': 'image/jpeg',
                        'cache-control': 'public, max-age=31536000'
                    }
                })
        });

        expect(image.headers.has('vary')).toBe(false);
    });

    it('answers an unknown API path and an unserved method in the error format of the API', async () => {
        const cookies = fakeCookies();
        await createSession(cookies, new URL('http://localhost'));
        // What SvelteKit answers on its own, before this hook rewrites it.
        const answer = (path: string, method: string, response: Response) =>
            handle({
                event: fakeEvent({ method, path, routeId: null, cookies }),
                resolve: async () => response
            });

        const unknown = await answer(
            '/api/nope',
            'GET',
            new Response('<html>Not Found</html>', {
                status: 404,
                headers: { 'content-type': 'text/html' }
            })
        );
        expect(unknown.status).toBe(404);
        expect(await unknown.json()).toEqual({
            error: { code: 'not_found', message: 'No such API route' }
        });

        const unserved = await answer(
            '/api/wines',
            'DELETE',
            new Response('DELETE method not allowed', {
                status: 405,
                headers: { allow: 'GET, HEAD' }
            })
        );
        expect(unserved.status).toBe(405);
        expect(unserved.headers.get('allow')).toBe('GET, HEAD');
        expect(await unserved.json()).toEqual({
            error: { code: 'method_not_allowed', message: 'This route does not answer DELETE' }
        });

        // The API's own 404 keeps its message and details, and a page keeps its HTML 404.
        const own = Response.json(
            { error: { code: 'not_found', message: 'Wine not found' } },
            {
                status: 404
            }
        );
        expect(await answer('/api/definitions/x', 'GET', own)).toBe(own);
        const page = new Response('<html></html>', {
            status: 404,
            headers: { 'content-type': 'text/html' }
        });
        expect(await answer('/nope', 'GET', page)).toBe(page);
    });
});
