import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toasts } from '#lib/stores/toast.svelte.js';
import { requireLogin } from './require-login.js';

const auth = vi.hoisted(() => ({ isAuthenticated: true }));
vi.mock('#lib/stores/auth.svelte.js', () => ({ auth }));

beforeEach(() => {
    toasts.items = [];
});

describe('requireLogin', () => {
    it('lets a logged-in user go on, silently', () => {
        auth.isAuthenticated = true;
        expect(requireLogin('Please log in')).toBe(true);
        expect(toasts.items).toEqual([]);
    });

    it('stops a visitor and asks them to log in', () => {
        auth.isAuthenticated = false;
        expect(requireLogin('Please log in')).toBe(false);
        expect(toasts.items).toMatchObject([{ type: 'warning', message: 'Please log in' }]);
    });
});
