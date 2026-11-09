import { invalidate } from '$app/navigation';
import { errorMessage, request } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { auth } from '#lib/stores/auth.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * Removes the target quantity of a wine at once, which takes it out of the shortage list, then
 * reloads the pages and the menu. A toast says so with the number removed, so that it can be typed
 * again, or says the refusal; a visitor is asked to log in, as for adding a bottle. The API
 * replaces a wine as a whole: the wine is read just before, so that its other fields stay as they
 * are now.
 */
export async function removeTargetQuantity(wine: { id: string; name: string }): Promise<void> {
    if (!auth.isAuthenticated) {
        toasts.add(m['auth.please_login_to_remove_target'](), 'warning');
        return;
    }
    const path = `/api/definitions/${encodeURIComponent(wine.id)}`;
    try {
        const current = await request<{ targetQuantity: number | null }>(path);
        await request(path, { method: 'PUT', json: { ...current, targetQuantity: null } });
        toasts.add(
            m['common.target_removed']({ name: wine.name, count: current.targetQuantity ?? 0 }),
            'success'
        );
    } catch (error) {
        toasts.add(errorMessage(error), 'error');
    }
    await invalidate(CELLAR);
}
