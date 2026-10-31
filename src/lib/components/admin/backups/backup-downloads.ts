import { invalidateAll } from '$app/navigation';
import { ApiError, downloadToDisk, errorMessage } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import type { BackupFileDTO } from '#lib/shared/dto.js';
import { toasts } from '#lib/stores/toast.svelte.js';

const downloadUrl = (filename: string) =>
    `/api/admin/download-backup?filename=${encodeURIComponent(filename)}`;

/** Whether the download failed because the file was deleted, by retention or in another tab. */
const isGone = (error: unknown) => error instanceof ApiError && error.code === 'not_found';

/** Makes the browser download a backup of the list, or says why it cannot. */
export async function downloadBackup({ filename }: BackupFileDTO) {
    try {
        await downloadToDisk(downloadUrl(filename), filename);
    } catch (error) {
        if (isGone(error)) {
            toasts.add(m['toast.backup_download_gone']({ filename }));
            await invalidateAll();
            return;
        }
        toasts.add(m['toast.backup_download_failed']({ filename, error: errorMessage(error) }));
    }
}

/**
 * The server backs the current data up before it replaces it, and the browser downloads that
 * backup too; then the page shows the new data. When the browser cannot download it, the message
 * stays until closed: it says where the backup is.
 */
export async function savePreviousData(filename: string) {
    try {
        await downloadToDisk(downloadUrl(filename), filename);
        toasts.add(m['toast.previous_data_downloaded']({ filename }), 'success', 8000);
    } catch (error) {
        if (error instanceof ApiError && error.code === 'unauthenticated') {
            // An expired session opens the login dialog, and the toasts drop its message: this one
            // says it in other words, or nothing would tell where the backup is. The page is not
            // reloaded: its load would send it to /wines?login, which reopens the login dialog without
            // that notice. Logging in again reloads it.
            toasts.add(
                m['toast.previous_data_not_downloaded_session_expired']({ filename }),
                'error',
                0
            );
            return;
        }
        const message = isGone(error)
            ? m['toast.previous_data_gone']({ filename })
            : m['toast.previous_data_not_downloaded']({ filename, error: errorMessage(error) });
        toasts.add(message, 'error', 0);
    }
    await invalidateAll();
}
