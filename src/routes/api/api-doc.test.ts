import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { requiresSession } from '#lib/server/session.js';
import { fakeEvent } from '../../test/event';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const routeModules = import.meta.glob<Record<string, unknown>>('./**/+server.ts', { eager: true });

/** `./bottles/[id]/+server.ts` → `/api/bottles/[id]` */
const routeIdOf = (file: string) => file.replace(/^\./, '/api').replace(/\/\+server\.ts$/, '');

/** What the route index of docs/API.md writes for a route id: `{id}` instead of `[id]`. */
const documentedPath = (routeId: string) => routeId.replace(/\[(\w+)\]/g, '{$1}');

const routes = Object.entries(routeModules).flatMap(([file, module]) =>
    Object.keys(module)
        .filter((name) => METHODS.includes(name))
        .map((method) => ({ method, routeId: routeIdOf(file) }))
);

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
