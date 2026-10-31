import type { RequestHandler } from './$types';
import {
    createMcpToken,
    getMcpTokenView,
    revokeMcpToken,
    setMcpWriteAllowed
} from '#lib/server/features/mcp/token.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { mcpTokenRequest } from '#lib/server/http/request-schemas.js';

/** Creates the MCP token, replacing the earlier one, and returns it this once. */
export const POST: RequestHandler = apiHandler(() => Response.json({ token: createMcpToken() }));

export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    setMcpWriteAllowed((await parseBody(request, mcpTokenRequest)).write);
    return Response.json(getMcpTokenView());
});

export const DELETE: RequestHandler = apiHandler(() => {
    revokeMcpToken();
    return new Response(null, { status: 204 });
});
