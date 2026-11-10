import { auth } from '#lib/stores/auth.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * Whether the user may go on with a change. A visitor sees the buttons that change the cellar: a
 * click shows `message`, which asks them to log in, and does nothing else.
 */
export function requireLogin(message: string): boolean {
    if (auth.isAuthenticated) return true;
    toasts.add(message, 'warning');
    return false;
}
