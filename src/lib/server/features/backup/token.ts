import type { RequestEvent } from '@sveltejs/kit';
import type { Tx } from '#lib/server/db/connection.js';
import { createStoredToken, sendsStoredToken } from '#lib/server/bearer-token.js';
import { getAppSetting, putBackAppSetting } from '#lib/server/features/settings/repository.js';

const TOKEN_HASH_KEY = 'auto_backup_token_hash';
const CRON_BACKUP_ROUTE = '/api/admin/auto-backup';

/** Creates the token of the cron job, replacing any earlier one, and returns it: it is shown once. */
export function createBackupToken(): string {
    return createStoredToken(TOKEN_HASH_KEY);
}

export function getBackupTokenHash(database?: Tx): string | undefined {
    return getAppSetting(TOKEN_HASH_KEY, database)?.value;
}

/**
 * Whether the request is the cron job's: a POST to the automatic backup route with the token in
 * `Authorization: Bearer <token>`. The token opens nothing else.
 */
export function isCronBackupRequest({ request, route }: RequestEvent): boolean {
    return (
        request.method === 'POST' &&
        route.id === CRON_BACKUP_ROUTE &&
        sendsStoredToken(request, TOKEN_HASH_KEY)
    );
}

/**
 * Like the access code, the token belongs to the instance, not to the data: the cron job keeps
 * working after a restore, and a backup cannot bring back an older token.
 */
export function putBackBackupToken(database: Tx, hash: string | undefined): void {
    putBackAppSetting(TOKEN_HASH_KEY, hash, database);
}
