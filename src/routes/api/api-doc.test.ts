import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openApiPath as documentedPath } from '#lib/server/openapi.js';
import { requiresSession } from '#lib/server/session.js';
import { apiRoutes as routes } from '../../test/api-routes';
import { fakeEvent } from '../../test/event';

const indexRows = [
    ...readFileSync('docs/API.md', 'utf8').matchAll(
        /^\| *(GET|POST|PUT|PATCH|DELETE) *\| *`([^`]+)` *\| *(yes|no)\b.*\|$/gm
    )
].map(([, method, path, session]) => ({ method, path, session }));

// docs/API.md is the contract that scripts rely on: its route index must follow the code.
describe('the route index of docs/API.md', () => {
    it('lists every route and method of the API, and nothing else', () => {
        const inCode = routes.map(({ method, routeId }) => `${method} ${documentedPath(routeId)}`);
        const documented = indexRows.map(({ method, path }) => `${method} ${path}`);

        expect(documented.toSorted()).toEqual(inCode.toSorted());
    });

    it('says which routes need a session, as the server decides it', () => {
        const sessionOf = new Map(
            indexRows.map(({ method, path, session }) => [`${method} ${path}`, session === 'yes'])
        );
        for (const { method, routeId } of routes) {
            const key = `${method} ${documentedPath(routeId)}`;
            expect(sessionOf.get(key), key).toBe(requiresSession(fakeEvent({ method, routeId })));
        }
    });
});
