import { describe, expect, it } from 'vitest';
import { createBackupToken, isCronBackupRequest } from '#lib/server/features/backup/token.js';
import { LONG_TEXT_MAX_LENGTH, NAME_MAX_LENGTH } from '#lib/shared/schemas/common.js';
import { GRAPE_MAX_LENGTH } from '#lib/shared/schemas/wine.js';
import { apiRoutes } from '../../test/api-routes';
import { fakeEvent } from '../../test/event';
import { openApiDocument, openApiPath } from './openapi';
import { requiresSession } from './session';

type Schema = { properties: Record<string, Schema>; items: Schema; maxLength?: number };

interface OperationObject {
    security: Record<string, string[]>[];
    requestBody?: { content: Record<string, { schema: Schema }> };
}

const document = openApiDocument();
const paths = document.paths as Record<string, Record<string, OperationObject>>;

const operationOf = (method: string, routeId: string) =>
    paths[openApiPath(routeId)]?.[method.toLowerCase()];

const jsonBodyOf = (method: string, routeId: string) =>
    operationOf(method, routeId)!.requestBody!.content['application/json'].schema;

describe('the OpenAPI description', () => {
    // What `pnpm test` checks in CI: the committed file is what the code gives. `pnpm openapi`
    // writes it again.
    it('is the one in docs/openapi.json', async () => {
        await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot(
            '../../../docs/openapi.json'
        );
    });

    it('describes every route and method of the API, and nothing else', () => {
        const described = Object.entries(paths).flatMap(([path, operations]) =>
            Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`)
        );
        const inCode = apiRoutes.map(({ method, routeId }) => `${method} ${openApiPath(routeId)}`);

        expect(described.toSorted()).toEqual(inCode.toSorted());
    });

    // openapi.ts asks requiresSession itself: the session half guards the event it builds for it.
    it('asks for a session where the server does, and for the cron token where it opens', () => {
        const token = createBackupToken();
        for (const { method, routeId } of apiRoutes) {
            const schemes = operationOf(method, routeId)!.security.flatMap(Object.keys);
            const asCron = fakeEvent({
                method,
                routeId,
                headers: { authorization: `Bearer ${token}` }
            });

            expect(schemes.includes('session'), routeId).toBe(
                requiresSession(fakeEvent({ method, routeId }))
            );
            expect(schemes.includes('cronToken'), routeId).toBe(isCronBackupRequest(asCron));
        }
    });

    // The routes count these lengths in UTF-16 units, with a check of their own that zod's
    // JSON Schema cannot read by itself.
    it('gives the most characters of the texts measured in UTF-16 units', () => {
        const wine = jsonBodyOf('POST', '/api/definitions').properties;
        const container = jsonBodyOf('POST', '/api/storage-containers').properties;
        const bottle = jsonBodyOf('POST', '/api/bottles').properties;

        expect(wine.name.maxLength).toBe(NAME_MAX_LENGTH);
        expect(wine.grapeVarieties.items.maxLength).toBe(GRAPE_MAX_LENGTH);
        expect(container.cases.items.maxLength).toBe(50);
        expect(bottle.notes).toEqual({
            anyOf: [{ type: 'string', maxLength: LONG_TEXT_MAX_LENGTH }, { type: 'null' }]
        });
    });
});
