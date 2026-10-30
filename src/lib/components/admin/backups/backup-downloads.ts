import { ApiError, downloadToDisk, errorMessage } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import type { BackupFileDTO } from '#lib/shared/dto.js';
import { toasts } from '#lib/stores/toast.svelte.js';

const downloadUrl = (filename: string) =>
    `/api/admin/download-backup?filename=${encodeURIComponent(filename)}`;

/** Makes the browser download a backup of the list, or says why it cannot. */
export async function downloadBackup({ filename }: BackupFileDTO) {
    try {
        await downloadToDisk(downloadUrl(filename), filename);
    } catch (error) {
        toasts.add(m['toast.backup_download_failed']({ filename, error: errorMessage(error) }));
    }
}

/**
 * The server backs the current data up before it replaces it, and the browser downloads that
 * backup too. When it cannot, the message stays until closed: it says where the backup is.
 */
export async function savePreviousData(filename: string) {
    try {
        await downloadToDisk(downloadUrl(filename), filename);
        toasts.add(m['toast.previous_data_downloaded']({ filename }), 'success', 8000);
    } catch (error) {
        // An expired session opens the login dialog, and the toasts drop its message: this one
        // says it in other words, or nothing would tell where the backup is.
        const message =
            error instanceof ApiError && error.code === 'unauthenticated'
                ? m['toast.previous_data_not_downloaded_session_expired']({ filename })
                : m['toast.previous_data_not_downloaded']({ filename, error: errorMessage(error) });
        toasts.add(message, 'error', 0);
    }
}
