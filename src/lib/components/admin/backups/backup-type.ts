import { m } from '#lib/paraglide/messages.js';

interface BackupFile {
    isAutomatic: boolean;
    isExport: boolean;
    /** manual-backup, automatic-backup-internal, automatic-export-cron, safety-backup-restore... */
    type: string;
}

/** What a file of the backup list is, in the user's language. */
export function backupTypeLabel(file: BackupFile): string {
    // Made by Cellar before a restore, a wipe or a JSON import.
    if (file.type.startsWith('safety-')) {
        return file.isExport
            ? m['admin.safety_export']()
            : m['admin.safety_backup']({
                  reason: file.type.endsWith('-reset') ? 'reset' : 'restore'
              });
    }
    if (!file.isAutomatic) {
        return file.isExport ? m['admin.manual_export']() : m['admin.manual_backup']();
    }
    const values = { source: file.type.endsWith('-cron') ? 'cron' : 'internal' };
    return file.isExport
        ? m['admin.automatic_export'](values)
        : m['admin.automatic_backup'](values);
}
