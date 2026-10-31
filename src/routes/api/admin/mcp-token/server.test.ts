import { describe, expect, it } from 'vitest';
import { getMcpTokenView } from '#lib/server/features/mcp/token.js';
import { fakeEvent } from '../../../../test/event';
import { DELETE, POST, PUT } from './+server';

type Event = Parameters<typeof POST>[0];
const call = (handler: typeof POST, method: string, body?: unknown) =>
    handler(
        fakeEvent<Event>({
            method,
            path: '/api/admin/mcp-token',
            routeId: '/api/admin/mcp-token',
            body
        })
    );

describe('/api/admin/mcp-token', () => {
    it('creates a token shown this once, and is read-only by default', async () => {
        expect(getMcpTokenView()).toEqual({ hasToken: false, write: false });

        const { token } = await (await call(POST, 'POST')).json();

        expect(token).toMatch(/^[\w-]{43}$/);
        expect(getMcpTokenView()).toEqual({ hasToken: true, write: false });
        expect(JSON.stringify(getMcpTokenView())).not.toContain(token);
    });

    it('allows or forbids changes, and keeps the choice for a new token', async () => {
        const allowed = await call(PUT, 'PUT', { write: true });

        expect(allowed.status).toBe(200);
        expect(await allowed.json()).toEqual(getMcpTokenView());
        expect(getMcpTokenView().write).toBe(true);
        await call(POST, 'POST');
        expect(getMcpTokenView().write).toBe(true);

        await call(PUT, 'PUT', { write: false });
        expect(getMcpTokenView().write).toBe(false);
    });

    it.each([
        ['no choice', {}],
        ['a choice that is not a boolean', { write: 'yes' }]
    ])('refuses %s, and changes nothing', async (_, body) => {
        const before = getMcpTokenView();

        expect((await call(PUT, 'PUT', body)).status).toBe(422);
        expect(getMcpTokenView()).toEqual(before);
    });

    it('revokes the token', async () => {
        await call(POST, 'POST');

        expect((await call(DELETE, 'DELETE')).status).toBe(204);
        expect(getMcpTokenView().hasToken).toBe(false);
    });
});
