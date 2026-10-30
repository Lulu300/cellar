import { toasts } from '#lib/stores/toast.svelte.js';
import { responseErrorMessage } from '#lib/utils/api-error.js';
import { saveResponse } from '#lib/utils/download.js';

/** What a download tells the user, once saved or once refused. */
interface DownloadMessages {
    saved: () => string;
    refused: (error: string) => string;
    failed: string;
}

/** Fetches a file of the barcode API, saves it, and tells the user how it went. */
export async function downloadFile(
    request: () => Promise<Response>,
    fallbackName: string,
    messages: DownloadMessages
): Promise<void> {
    try {
        const response = await request();
        if (!response.ok) {
            toasts.add(messages.refused(await responseErrorMessage(response)), 'error');
            return;
        }
        await saveResponse(response, fallbackName);
        toasts.add(messages.saved(), 'success');
    } catch {
        toasts.add(messages.failed, 'error');
    }
}

/** Sends `body` as JSON. */
export const sendJson = (method: 'POST' | 'PUT', url: string, body: unknown) =>
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
