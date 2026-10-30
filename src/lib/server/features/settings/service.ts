import type { Cookies } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import type { Session } from '#lib/server/db/schema.js';
import {
    ACCESS_CODE_KEY,
    getStoredAccessCode,
    hashAccessCode,
    verifyAccessCode
} from '#lib/server/access-code.js';
import { ConflictError, ForbiddenError, TooManyAttemptsError } from '#lib/server/http/errors.js';
import { clearAttempts, registerAttempt } from '#lib/server/login-attempts.js';
import {
    getSessionTimeoutHours,
    keepOnlySession,
    SESSION_TIMEOUT_KEY,
    setSessionCookie,
    startSession,
    createSession
} from '#lib/server/session.js';
import { announceSetupToken, isSetupToken, revokeSetupToken } from '#lib/server/setup-token.js';
import { insertAppSettingIfMissing, setAppSetting } from './repository';

export interface Settings {
    sessionTimeoutHours: number;
}

export function getSettings(): Settings {
    return { sessionTimeoutHours: getSessionTimeoutHours() };
}

export function saveSettings({ sessionTimeoutHours }: Settings): void {
    // One statement, so already all or nothing.
    setAppSetting(SESSION_TIMEOUT_KEY, String(sessionTimeoutHours));
}

/** Who sends a request: its address, and its cookies and URL, to start a session. */
export interface Client {
    address: string;
    cookies: Cookies;
    url: URL;
}

/** Whether an access code is set. When none is, logs the setup token that choosing one takes. */
export async function accessCodeExists(): Promise<boolean> {
    const exists = (await getStoredAccessCode(db)) !== undefined;
    if (!exists) announceSetupToken();
    return exists;
}

/** Counts an attempt at a secret; throws TooManyAttemptsError while the client is blocked. */
function limitAttempts(address: string): void {
    const retryAfter = registerAttempt(address);
    if (retryAfter > 0) throw new TooManyAttemptsError(retryAfter);
}

/** The only place that checks a submitted code, for both login and code change. */
async function checkAccessCode(code: string, address: string): Promise<boolean> {
    limitAttempts(address);
    const storedHash = await getStoredAccessCode(db);
    const isValid = storedHash !== undefined && (await verifyAccessCode(code, storedHash));
    if (isValid) clearAttempts(address);
    return isValid;
}

/** Starts a session when `code` is the access code; returns whether it is. */
export async function logIn(code: string, { address, cookies, url }: Client): Promise<boolean> {
    const valid = await checkAccessCode(code, address);
    if (valid) createSession(cookies, url);
    return valid;
}

const codeAlreadySet = () =>
    new ConflictError('access_code_already_set', 'An access code is already set');

/**
 * First launch: no code exists yet, so whoever holds the setup token from the server logs chooses
 * it, and is logged in. Wrong tokens count as attempts, like wrong codes. As with a code change,
 * sessions opened under an earlier code, such as one reset by hand, end.
 */
export async function setFirstAccessCode(
    newCode: string,
    setupToken: string,
    { address, cookies, url }: Client
): Promise<void> {
    // Checked first so that requests sent once the code is set cost no hash, nor an attempt.
    if ((await getStoredAccessCode(db)) !== undefined) throw codeAlreadySet();

    limitAttempts(address);
    if (!isSetupToken(setupToken)) {
        throw new ForbiddenError('wrong_setup_token', 'Invalid setup token');
    }
    clearAttempts(address);

    const hash = await hashAccessCode(newCode);
    // The code and the only session, or neither. The unique key refuses every insert but one,
    // even when several requests race.
    const started = db.transaction((tx) => {
        if (!insertAppSettingIfMissing(ACCESS_CODE_KEY, hash, tx)) throw codeAlreadySet();
        const started = startSession(tx);
        keepOnlySession(started.session, tx);
        return started;
    });
    revokeSetupToken();
    setSessionCookie(cookies, url, started);
}

/**
 * Replaces the access code, and ends every session but the caller's, so that the old code stops
 * working everywhere.
 */
export async function changeAccessCode(
    currentCode: string,
    newCode: string,
    address: string,
    session: Session
): Promise<void> {
    // 403, not 401: the client treats 401 as an expired session and logs the user out.
    if (!(await checkAccessCode(currentCode, address))) {
        throw new ForbiddenError('wrong_access_code', 'Current access code is incorrect');
    }
    const hash = await hashAccessCode(newCode);
    db.transaction((tx) => {
        setAppSetting(ACCESS_CODE_KEY, hash, tx);
        keepOnlySession(session, tx);
    });
}
