import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import type { Tx } from '#lib/server/db/connection.js';
import {
    getAppSetting,
    putBackAppSetting,
    setAppSetting
} from '#lib/server/features/settings/repository.js';
import { hashToken } from '#lib/server/session.js';

// Only its hash is stored, like a session token's: the token is random and long, so a plain
// SHA-256 cannot be reversed, and a backup of the database does not reveal it.
const TOKEN_HASH_KEY = 'auto_backup_token_hash';
const CRON_BACKUP_ROUTE = '/api/admin/auto-backup';

/** Creates the token of the cron job, replacing any earlier one, and returns it: it is shown once. */
export function createBackupToken(): string {
    const token = randomBytes(32).toString('base64url');
    setAppSetting(TOKEN_HASH_KEY, hashToken(token));
    return token;
}

export function getBackupTokenHash(database?: Tx): string | undefined {
    return getAppSetting(TOKEN_HASH_KEY, database)?.value;
}

/**
 * Whether the request is the cron job's: a POST to the automatic backup route with the token in
 * `Authorization: Bearer <token>`. The token opens nothing else.
 */
export function isCronBackupRequest({ request, route }: RequestEvent): boolean {
    if (request.method !== 'POST' || route.id !== CRON_BACKUP_ROUTE) return false;

    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    const storedHash = getBackupTokenHash();
    if (!token || !storedHash) return false;

    const expected = Buffer.from(storedHash);
    const actual = Buffer.from(hashToken(token));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Like the access code, the token belongs to the instance, not to the data: the cron job keeps
 * working after a restore, and a backup cannot bring back an older token.
 */
export function putBackBackupToken(database: Tx, hash: string | undefined): void {
    putBackAppSetting(TOKEN_HASH_KEY, hash, database);
}
