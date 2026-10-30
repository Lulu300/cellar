import { afterEach, describe, expect, it, vi } from 'vitest';
import { auth } from './auth.svelte.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('auth.authenticate', () => {
    it('tells a restore in progress apart from a wrong code', async () => {
        // The store only logs in from a browser.
        vi.stubGlobal('window', {});
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json(
                    { error: { code: 'writes_held', message: 'A restore is in progress.' } },
                    { status: 503 }
                )
            )
        );

        expect(await auth.authenticate('4821')).toEqual({ valid: false, restoring: true });
    });

    it('reads the delay of a client blocked after too many attempts', async () => {
        vi.stubGlobal('window', {});
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json(
                    { error: { code: 'too_many_attempts', message: 'Too many attempts' } },
                    { status: 429, headers: { 'Retry-After': '30' } }
                )
            )
        );

        expect(await auth.authenticate('4821')).toEqual({ valid: false, retryAfter: 30 });
    });
});

describe('auth.checkSession', () => {
    // A ?login reached by going back in the history while logged in showed the visitor as logged
    // out (UI-17 review): the page now asks the server instead of assuming.
    it('takes the state of the session from the server', async () => {
        const answer = { authenticated: true };
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json(answer))
        );

        await auth.checkSession();
        expect(auth.isAuthenticated).toBe(true);

        answer.authenticated = false;
        await auth.checkSession();
        expect(auth.isAuthenticated).toBe(false);
    });

    it('keeps what the page shows when the server cannot be reached', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ authenticated: true }))
        );
        await auth.checkSession();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            })
        );

        await auth.checkSession();
        expect(auth.isAuthenticated).toBe(true);
    });
});
