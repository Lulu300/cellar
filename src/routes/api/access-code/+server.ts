import { z } from 'zod';
import type { RequestHandler } from './$types';
import { MAX_ACCESS_CODE_LENGTH } from '#lib/server/access-code.js';
import {
    accessCodeExists,
    changeAccessCode,
    logIn,
    setFirstAccessCode
} from '#lib/server/features/settings/service.js';
import { parseBody, parseWith } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_SETUP_TOKEN_LENGTH } from '#lib/server/setup-token.js';
import { MIN_ACCESS_CODE_LENGTH } from '#lib/utils/access-code.js';

const code = z.string().min(1).max(MAX_ACCESS_CODE_LENGTH);

/** A code about to be stored. */
const newCode = z.string().min(MIN_ACCESS_CODE_LENGTH).max(MAX_ACCESS_CODE_LENGTH);

const loginSchema = z.object({ code });

const firstCodeSchema = z.object({
    newCode,
    setupToken: z.string().min(1).max(MAX_SETUP_TOKEN_LENGTH)
});

const codeChangeSchema = z.object({ currentCode: code, newCode });

// Tells the login dialog whether to ask for the first code instead of the current one.
export const GET: RequestHandler = apiHandler(async () =>
    Response.json({ exists: await accessCodeExists() })
);

// Login with { code }, or first-launch setup with { newCode, setupToken }.
export const POST: RequestHandler = apiHandler(
    async ({ request, cookies, url, getClientAddress }) => {
        const body = await parseBody(request, z.record(z.string(), z.unknown()));
        const client = { address: getClientAddress(), cookies, url };
        if ('newCode' in body) {
            const { newCode, setupToken } = parseWith(firstCodeSchema, body);
            await setFirstAccessCode(newCode, setupToken, client);
            return Response.json({ valid: true });
        }
        const { code } = parseWith(loginSchema, body);
        return Response.json({ valid: await logIn(code, client) });
    }
);

// Changes the access code (only for authenticated users). The answer has no body: the code saved
// is a secret, which it does not give back.
export const PUT: RequestHandler = apiHandler(async ({ request, locals, getClientAddress }) => {
    const { currentCode, newCode } = await parseBody(request, codeChangeSchema);
    // Never null: hooks.server.ts answers 401 to any PUT without a session.
    await changeAccessCode(currentCode, newCode, getClientAddress(), locals.session!);
    return new Response(null, { status: 204 });
});
