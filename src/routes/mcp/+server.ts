import { serveMcp } from '#lib/server/features/mcp/server.js';
import { requireMcpAccess } from '#lib/server/features/mcp/token.js';
import type { RequestHandler } from './$types';

// Every message of the protocol is a POST: without sessions, the server has no stream to open on a
// GET and none to close on a DELETE, which SvelteKit answers 405.
export const POST: RequestHandler = ({ request, locals }) =>
    serveMcp(request, requireMcpAccess(locals));
