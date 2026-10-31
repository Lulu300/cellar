import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getAppSetting, setAppSetting } from '#lib/server/features/settings/repository.js';
import { hashToken } from '#lib/server/session.js';

// The tokens that programs send instead of logging in: the cron job's (backup/token.ts) and the MCP
// client's (mcp/token.ts). Only the hash of each is stored, like a session token's: the token is
// random and long, so a plain SHA-256 cannot be reversed, and a backup of the database does not
// reveal it.

/** Creates a token, whose hash replaces the setting `hashKey`, and returns it: it is shown once. */
export function createStoredToken(hashKey: string): string {
    const token = randomBytes(32).toString('base64url');
    setAppSetting(hashKey, hashToken(token));
    return token;
}

/** Whether the request sends, as `Authorization: Bearer <token>`, the token stored under `hashKey`. */
export function sendsStoredToken(request: Request, hashKey: string): boolean {
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    const storedHash = getAppSetting(hashKey)?.value;
    if (!token || !storedHash) return false;

    const expected = Buffer.from(storedHash);
    const actual = Buffer.from(hashToken(token));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
