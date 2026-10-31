import type { RequestEvent } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { prepareDatabase } from '#lib/server/db/index.js';
import { removeLeftoverFiles } from '#lib/server/features/backup/leftovers.js';
import { reschedule } from '#lib/server/features/backup/scheduler.js';
import { isCronBackupRequest } from '#lib/server/features/backup/token.js';
import { rejectCrossOriginRequest, SAFE_METHODS } from '#lib/server/csrf.js';
import { MethodNotAllowedError, NotFoundError } from '#lib/server/http/errors.js';
import { apiErrorResponse } from '#lib/server/http/handler.js';
import { authenticate } from '#lib/server/session.js';
import {
    checkUpgrade,
    logMissingPrerequisite,
    recordStartup,
    UpgradeRefusal,
    type UpgradePlan
} from '#lib/server/upgrade.js';
import { runWrite } from '#lib/server/write-gate.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

// The restore, the JSON import and the wipe hold the other writes themselves, while they save then
// replace the data.
const ROUTES_HOLDING_WRITES = new Set([
    '/api/admin/restore',
    '/api/admin/import-json',
    '/api/admin/wipe-database'
]);

// Runs before the server listens. The database opens first, so exitUnlessDirsWritable() stops the
// process when a data folder is not writable. Not during the build, which runs init when it
// prerenders a page.
export const init: ServerInit = async () => {
    if (building) return;
    let upgrade: UpgradePlan;
    try {
        upgrade = checkUpgrade();
    } catch (error) {
        if (error instanceof UpgradeRefusal) {
            // Opening the database may have switched its file to WAL, but no data was written.
            console.error(
                `❌ Cellar ${__APP_VERSION__} cannot start: ${error.message} No data was changed.`
            );
        } else {
            console.error('❌ Cellar cannot start: the upgrade check failed.', error);
        }
        process.exit(1);
    }
    try {
        // Recorded as soon as the schema is migrated: a start stopped later, during a long first
        // seeding for example, must not leave a migrated database without its version.
        await prepareDatabase(() => recordStartup(upgrade));
    } catch (error) {
        // Serving from a database that the code does not match would fail request after request,
        // behind a container that looks healthy.
        console.error('❌ Cellar cannot start: the database could not be prepared.', error);
        process.exit(1);
    }
    logMissingPrerequisite();
    removeLeftoverFiles();
    // An overdue backup starts once the server is up, without delaying it.
    reschedule();
};

export const handle: Handle = async ({ event, resolve }) => {
    // Messages and formats follow the language that the middleware picks for each request: the
    // language cookie, then the browser's languages, then English. The middleware gets the request
    // without its body, all it reads being the URL and the headers: it copies the request it is
    // given, which would tee the body, and the branch that no one reads would hold a whole upload
    // in memory.
    const response = await paraglideMiddleware(withoutBody(event.request), ({ locale }) =>
        handleRequest(event, async (event) =>
            inApiFormat(
                event,
                await resolve(event, {
                    transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
                })
            )
        )
    );
    // The middleware adds `Vary: Cookie, Accept-Language` to every response. An image is the same
    // in every language and for every visitor, and the browser keeps it for a year: with that
    // header, it would download every image again after a login or a change of language.
    if (event.url.pathname.startsWith('/uploads/')) response.headers.delete('Vary');
    return response;
};

/**
 * SvelteKit answers a path under /api that matches no route with its HTML error page, and a method
 * that the route lacks in plain text: the API answers both in its own error format, which clients
 * and scripts read.
 */
function inApiFormat({ url, request }: RequestEvent, response: Response): Response {
    const isJson = response.headers.get('content-type')?.startsWith('application/json');
    if (!url.pathname.startsWith('/api/') || isJson) return response;
    if (response.status === 404) return apiErrorResponse(new NotFoundError('No such API route'));
    if (response.status === 405) {
        return apiErrorResponse(
            new MethodNotAllowedError(request.method, response.headers.get('allow'))
        );
    }
    return response;
}

const withoutBody = ({ url, method, headers }: Request) => new Request(url, { method, headers });

async function handleRequest(
    event: RequestEvent,
    resolve: (event: RequestEvent) => Promise<Response>
): Promise<Response> {
    const forbidden = rejectCrossOriginRequest(event);
    if (forbidden) return forbidden;

    const unauthenticated = await authenticate(event);
    if (unauthenticated && !isCronBackupRequest(event)) return unauthenticated;

    if (SAFE_METHODS.has(event.request.method) || ROUTES_HOLDING_WRITES.has(event.route.id ?? '')) {
        return resolve(event);
    }
    return runWrite(() => resolve(event));
}
