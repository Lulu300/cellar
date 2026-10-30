import type { RequestEvent } from '@sveltejs/kit';
import { ApiError } from '#lib/server/http/errors.js';
import { apiErrorResponse } from '#lib/server/http/handler.js';

/** Methods that never change state: no Origin check here, no session needed in session.ts. */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Extends SvelteKit's built-in CSRF origin check, which only covers POST, PUT, PATCH and DELETE
 * requests with a form content type (urlencoded, multipart, text/plain) or none, and is skipped in
 * dev. This one covers every state-changing method and content type, in dev too.
 *
 * Browsers always send an `Origin` header on cross-origin non-GET requests, so any state-changing
 * request whose Origin differs from the server's own origin is refused. Both checks use the same
 * origin, `url.origin`: ORIGIN when it is set (applied by server.js), otherwise what adapter-node
 * reads from the request headers. Requests without an Origin header (curl, scripts) are left to
 * SvelteKit's check and to the authentication layer.
 *
 * This hook does not read `csrf.trustedOrigins` (vite.config.ts). If trusted origins are ever
 * configured there, they must be allowed here too, or their requests will still get 403.
 *
 * Returns a 403 response to send back, or null when the request may proceed.
 */
export function rejectCrossOriginRequest(event: RequestEvent): Response | null {
    const { request, url } = event;
    if (SAFE_METHODS.has(request.method)) return null;

    const origin = request.headers.get('origin');
    if (origin === null || origin === url.origin) return null;

    return apiErrorResponse(
        new ApiError(
            403,
            'cross_site_request',
            `Cross-site ${request.method} requests are forbidden`
        )
    );
}
