import { invalidate } from '$app/navigation';
import { ApiError, errorMessage, request } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { requireLogin } from '#lib/components/layout/require-login.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * Removes the target quantity of a wine at once, which takes it out of the shortage list, then
 * reloads the pages and the menu. A toast says so with the number removed, so that it can be typed
 * again, or says the refusal; a visitor is asked to log in, as for adding a bottle. Returns
 * whether the wine has no target any more.
 *
 * The API replaces a wine as a whole: the wine is read just before, so that its other fields stay
 * as they are now. A wine saved by an older version may hold a field that the API no longer
 * accepts, such as a longer name: the toast then sends the user to the wine's form.
 */
export async function removeTargetQuantity(wine: { id: string; name: string }): Promise<boolean> {
    if (!requireLogin(m['auth.please_login_to_remove_target']())) return false;
    const path = `/api/definitions/${encodeURIComponent(wine.id)}`;
    let removed = false;
    try {
        const current = await request<{ targetQuantity: number | null }>(path);
        // Already removed elsewhere: the reload below is all that is left to do.
        if (current.targetQuantity !== null) {
            await request(path, { method: 'PUT', json: { ...current, targetQuantity: null } });
            toasts.add(
                m['common.target_removed']({ name: wine.name, count: current.targetQuantity }),
                'success'
            );
        }
        removed = true;
    } catch (error) {
        toasts.add(
            error instanceof ApiError && error.status === 422
                ? m['common.target_not_removed']({ name: wine.name })
                : errorMessage(error),
            'error'
        );
    }
    await invalidate(CELLAR);
    return removed;
}
