import type { RequestEvent } from '@sveltejs/kit';
import type { Tx } from '#lib/server/db/connection.js';
import { createStoredToken, sendsStoredToken } from '#lib/server/bearer-token.js';
import {
    deleteAppSetting,
    getAppSetting,
    getStoredAppSettings,
    putBackAppSettings,
    setAppSetting,
    type StoredAppSettings
} from '#lib/server/features/settings/repository.js';
import { ApiError } from '#lib/server/http/errors.js';
import { apiErrorResponse } from '#lib/server/http/handler.js';

const TOKEN_HASH_KEY = 'mcp_token_hash';
// Apart from the token: a new token keeps the choice, and the card shows it with or without one.
const WRITE_KEY = 'mcp_write_allowed';
const MCP_ROUTE = '/mcp';

/** What the MCP token lets the assistant do, for the tools of the MCP server. */
export interface McpAccess {
    /** Whether the write tools may run: off until the admin allows it. */
    write: boolean;
}

const isWriteAllowed = () => getAppSetting(WRITE_KEY)?.value === 'true';

/** Whether there is a token, never the token itself, and whether it may write. */
export function getMcpTokenView() {
    return { hasToken: getAppSetting(TOKEN_HASH_KEY) !== undefined, write: isWriteAllowed() };
}

/** Creates the MCP token, replacing any earlier one, and returns it: it is shown once. */
export function createMcpToken(): string {
    return createStoredToken(TOKEN_HASH_KEY);
}

/** Revokes the token: /mcp refuses every request until a new one is created. */
export function revokeMcpToken(): void {
    deleteAppSetting(TOKEN_HASH_KEY);
}

export function setMcpWriteAllowed(write: boolean): void {
    setAppSetting(WRITE_KEY, String(write));
}

/** Whether the request goes to the MCP server, which answers at /mcp and below. */
export function isMcpRequest({ route }: RequestEvent): boolean {
    // Widened: SvelteKit types the ids of the routes that exist, and /mcp comes with its server.
    const id: string | null = route.id;
    return id === MCP_ROUTE || id?.startsWith(`${MCP_ROUTE}/`) === true;
}

/**
 * The hook's check for a request to /mcp, whatever its method: the MCP token, sent as
 * `Authorization: Bearer <token>`, is the only way in, and fills `locals.mcpAccess`. A session
 * cookie opens nothing there, and the token opens nothing else (hooks.server.ts).
 * Returns the 401 to send when the token is missing, wrong or revoked, or null when the request may
 * proceed.
 */
export function authenticateMcp(event: RequestEvent): Response | null {
    event.locals.session = null;
    if (!sendsStoredToken(event.request, TOKEN_HASH_KEY)) {
        return apiErrorResponse(
            new ApiError(401, 'unauthenticated', 'A valid MCP token is required', undefined, {
                'WWW-Authenticate': 'Bearer'
            })
        );
    }
    // Read at each request: a change in the admin applies to the next call of the assistant.
    event.locals.mcpAccess = { write: isWriteAllowed() };
    return null;
}

/** For each write tool of the MCP server: refuses the call when the token is read-only. */
export function assertMcpWrite(access: McpAccess): void {
    if (!access.write) {
        throw new Error(
            'This MCP token is read-only: changes can be allowed in Cellar, under Admin › Settings › MCP access.'
        );
    }
}

/** The MCP settings as stored, for putBackMcpSettings. */
export function storedMcpSettings(): StoredAppSettings {
    return getStoredAppSettings([TOKEN_HASH_KEY, WRITE_KEY]);
}

/**
 * Like the cron token, the MCP token and its write option belong to the instance, not to the data:
 * the assistant keeps its access after a restore, and a backup cannot bring back an older token.
 */
export function putBackMcpSettings(staged: Tx, stored: StoredAppSettings): void {
    putBackAppSettings(stored, staged);
}
