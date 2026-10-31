import { createHash, randomBytes } from 'node:crypto';
import { redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { eq, lt } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { sessions, type Session } from '#lib/server/db/schema.js';
import { SAFE_METHODS } from '#lib/server/csrf.js';
import { getAppSetting } from '#lib/server/features/settings/repository.js';
import { ApiError } from '#lib/server/http/errors.js';
import { apiErrorResponse } from '#lib/server/http/handler.js';
import { isValidSessionTimeout } from '#lib/shared/session-timeout.js';

export const SESSION_COOKIE = 'cellar_session';
export const SESSION_TIMEOUT_KEY = 'session_timeout_hours';
const DEFAULT_SESSION_TIMEOUT_HOURS = 24;

/** How a random token is stored: a session's, or a program's (bearer-token.ts). */
export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

// Shared by set and delete. SvelteKit defaults to `secure: true` (except on localhost), and a
// browser ignores a Secure cookie sent over plain HTTP, so a delete with the defaults would never
// clear the cookie on an install served over HTTP on the LAN.
function cookieOptions(url: URL) {
    return {
        path: '/',
        httpOnly: true,
        // Not strict: a link from another site, such as a NAS dashboard, must open Cellar logged in.
        // Lax still keeps the cookie off cross-site POSTs, which csrf.ts rejects anyway.
        sameSite: 'lax',
        // url already honours ORIGIN and PROTOCOL_HEADER, so this follows how the browser reaches us.
        secure: url.protocol === 'https:'
    } as const;
}

/** The setting, or the default when it is missing or holds a value saved before it was validated. */
export function getSessionTimeoutHours(tx: Tx = db): number {
    const hours = Number(getAppSetting(SESSION_TIMEOUT_KEY, tx)?.value);
    return isValidSessionTimeout(hours) ? hours : DEFAULT_SESSION_TIMEOUT_HOURS;
}

/**
 * Reads are public; writes and the whole admin API, sensitive GETs included, need a session.
 * Matching on the route id rather than the raw pathname keeps percent-encoded variants such as
 * `/api/%61dmin/...`, which the router decodes, from slipping through.
 */
export function requiresSession({ request, route }: RequestEvent): boolean {
    if (route.id?.startsWith('/api/admin/')) return true;
    if (SAFE_METHODS.has(request.method)) return false;
    const isLogin = request.method === 'POST' && route.id === '/api/access-code';
    return !isLogin;
}

/**
 * Fills `locals.session` for the request. Returns the 401 to send when the request needs a
 * session it does not have, or null when it may proceed.
 */
export async function authenticate(event: RequestEvent): Promise<Response | null> {
    event.locals.session = await getSession(event.cookies);
    if (!event.locals.session && requiresSession(event)) {
        return apiErrorResponse(new ApiError(401, 'unauthenticated', 'Authentication required'));
    }
    return null;
}

/**
 * Server load guard for the pages that only work logged in. `?login` asks the root layout to open
 * the login dialog; `requiresSession` tells it to leave the page once the user is logged out.
 */
export function redirectWithoutSession(locals: App.Locals) {
    if (!locals.session) redirect(303, '/wines?login');
    return { requiresSession: true };
}

/** A session started in a transaction, whose cookie is set once the transaction commits. */
export interface StartedSession {
    token: string;
    session: Session;
}

/**
 * Starts a session in `tx`. The expiry is fixed at login, so a new timeout setting applies from
 * the next login. Expired sessions are purged here: logins are rare, and an expired row is
 * already rejected by getSession.
 */
export function startSession(tx: Tx): StartedSession {
    const now = new Date();
    tx.delete(sessions).where(lt(sessions.expiresAt, now)).run();

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + getSessionTimeoutHours(tx) * 60 * 60 * 1000);
    const session = { tokenHash: hashToken(token), expiresAt };
    tx.insert(sessions).values(session).run();
    return { token, session };
}

/** Sets the cookie of a session that `startSession` started. */
export function setSessionCookie(cookies: Cookies, url: URL, { token, session }: StartedSession) {
    cookies.set(SESSION_COOKIE, token, { ...cookieOptions(url), expires: session.expiresAt });
}

/** Starts a session and sets its cookie. */
export function createSession(cookies: Cookies, url: URL): Session {
    const started = db.transaction((tx) => startSession(tx));
    setSessionCookie(cookies, url, started);
    return started.session;
}

export async function getSession(cookies: Cookies): Promise<Session | null> {
    const token = cookies.get(SESSION_COOKIE);
    if (!token) return null;

    const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hashToken(token)));
    return session && session.expiresAt > new Date() ? session : null;
}

export async function destroySession(cookies: Cookies, url: URL, session: Session): Promise<void> {
    await db.delete(sessions).where(eq(sessions.tokenHash, session.tokenHash));
    cookies.delete(SESSION_COOKIE, cookieOptions(url));
}

/**
 * Ends every session except the caller's, who stays logged in. Used after a code change, so the
 * old code stops working everywhere, after the first code is chosen, and on a backup being
 * restored, whose database brings back the sessions of the day it was saved, some of them logged
 * out since.
 */
export function keepOnlySession(session: Session, database: Tx = db): void {
    database.transaction((tx) => {
        tx.delete(sessions).run();
        tx.insert(sessions).values(session).run();
    });
}
