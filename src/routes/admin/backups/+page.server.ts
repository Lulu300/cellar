import { getBarcodeSettings } from '#lib/server/features/barcode/service.js';
import { listBackups } from '#lib/server/features/backup/files.js';
import { getBackupSettingsView } from '#lib/server/features/backup/service.js';
import { csvImportTables } from '#lib/server/features/csv-import/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    return {
        backups: await listBackups(),
        backupSettings: getBackupSettingsView(),
        // A CSV import asks whether to replace the barcodes only when they are automatic.
        barcodeAutoGeneration: getBarcodeSettings().autoGeneration,
        csvTables: csvImportTables()
    };
};
