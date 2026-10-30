import { GET } from '../routes/api/admin/download-backup/+server';
import { fakeEvent } from './event';

/** Calls GET /api/admin/download-backup for the file named `filename`. */
export function downloadBackup(filename: string) {
    return GET(
        fakeEvent<Parameters<typeof GET>[0]>({
            path: `/api/admin/download-backup?filename=${encodeURIComponent(filename)}`
        })
    );
}
