// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '#lib/server/db/schema.js';
import type { McpAccess } from '#lib/server/features/mcp/token.js';

declare global {
    /** The version from package.json, replaced at build time by Vite (vite.config.ts). */
    const __APP_VERSION__: string;

    namespace App {
        // interface Error {}
        interface Locals {
            /** Filled by hooks.server.ts: the valid session of the request, or null. */
            session: Session | null;
            /** Filled by hooks.server.ts on the MCP routes only: what the request's MCP token allows. */
            mcpAccess?: McpAccess;
        }
        interface PageData {
            /** Set by the root layout: whether the request has a valid session. */
            authenticated: boolean;
            /** Set by the root layout: false until someone chooses the first access code. */
            accessCodeSet: boolean;
            /** Set by redirectWithoutSession on the pages that only work logged in. */
            requiresSession?: boolean;
        }
        // interface PageState {}
        // interface Platform {}
    }
}

export {};
