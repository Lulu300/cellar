import { afterEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { toasts } from './toast.svelte.js';

afterEach(() => {
    vi.useRealTimers();
    toasts.items = [];
});

describe('toasts', () => {
    it('removes a message once its duration has passed, and keeps one without duration', () => {
        vi.useFakeTimers();
        toasts.add('Saved', 'success', 4000);
        toasts.add('Read me', 'warning', 0);

        vi.advanceTimersByTime(3999);
        expect(toasts.items.map((toast) => toast.message)).toEqual(['Saved', 'Read me']);

        vi.advanceTimersByTime(1);
        expect(toasts.items.map((toast) => toast.message)).toEqual(['Read me']);
    });

    it('closes only the message asked for', () => {
        toasts.add('First', 'error', 0);
        toasts.add('Second', 'error', 0);

        toasts.remove(toasts.items[0].id);

        expect(toasts.items.map((toast) => toast.message)).toEqual(['Second']);
    });

    it('leaves an expired session to the login dialog', () => {
        toasts.add(m['errors.unauthenticated'](), 'error', 0);

        expect(toasts.items).toEqual([]);
    });

    it('leaves it to the dialog too when the error of an action names it', () => {
        const error = m['errors.unauthenticated']();
        toasts.add(m['toast.failed_to_delete_backup']({ error }), 'error', 0);
        toasts.add(m['toast.failed_to_delete_backup']({ error: 'Not found' }), 'error', 0);

        expect(toasts.items.map((toast) => toast.message)).toEqual([
            m['toast.failed_to_delete_backup']({ error: 'Not found' })
        ]);
    });
});
