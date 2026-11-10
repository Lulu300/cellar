import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerLoginDialog } from '#lib/components/layout/login-prompt.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { whenLoggedIn } from './bottle-dialogs.svelte';

const { auth } = vi.hoisted(() => ({ auth: { isAuthenticated: true } }));
vi.mock('#lib/stores/auth.svelte.js', () => ({ auth }));

const showLogin = vi.fn();
let unregister: () => void;

beforeEach(() => {
    vi.clearAllMocks();
    toasts.items = [];
    unregister = registerLoginDialog(showLogin);
});
afterEach(() => unregister());

// UI-34: every write of a bottle list asks a visitor for the code the same way.
describe('whenLoggedIn', () => {
    it('runs the action for a session', () => {
        const action = vi.fn();
        whenLoggedIn(action);

        expect(action).toHaveBeenCalledOnce();
        expect(showLogin).not.toHaveBeenCalled();
    });

    it('opens the login dialog for a visitor, without a toast and without running the action', () => {
        auth.isAuthenticated = false;
        const action = vi.fn();
        whenLoggedIn(action);

        expect(showLogin).toHaveBeenCalledOnce();
        expect(action).not.toHaveBeenCalled();
        expect(toasts.items).toEqual([]);
        auth.isAuthenticated = true;
    });
});
