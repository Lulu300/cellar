import { invalidate } from '$app/navigation';
import { errorMessage, request } from '#lib/api/client.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * Creates a row of a reference list from the select of a form, then reloads the lists of the
 * layout, so that every select offers it. Throws once it told the user why the server refused it:
 * the select then keeps what was typed.
 */
export async function createReference<Row extends { id: string; name: string }>(
    url: string,
    body: Record<string, string>
): Promise<Row> {
    let row: Row;
    try {
        row = await request<Row>(url, { method: 'POST', json: body });
    } catch (error) {
        toasts.add(errorMessage(error), 'error', 5000);
        throw error;
    }
    await invalidate(CELLAR);
    return row;
}
