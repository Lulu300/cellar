import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../../test/locale';
import { backupTypeLabel } from './backup-type';

// The types that list-backups gives (features/backup/files.ts).
const file = (type: string) => ({
    type,
    isAutomatic: type.startsWith('automatic-'),
    isExport: type.includes('-export')
});

describe('backupTypeLabel', () => {
    it('names each type that the backup list gives', () => {
        const label = (type: string) => backupTypeLabel(file(type));

        expect(label('manual-backup')).toBe('Manual backup');
        expect(label('manual-export')).toBe('Manual export');
        expect(label('automatic-backup-internal')).toBe('Automatic backup (scheduler)');
        expect(label('automatic-backup-cron')).toBe('Automatic backup (cron)');
        expect(label('automatic-export-internal')).toBe('Automatic export (scheduler)');
        expect(label('automatic-export-cron')).toBe('Automatic export (cron)');
        expect(label('safety-backup-restore')).toBe('Backup before restore');
        expect(label('safety-backup-reset')).toBe('Backup before wipe');
        expect(label('safety-export-import')).toBe('Export before import');
    });

    it('speaks the language of the interface', () => {
        useLocale('fr');
        expect(backupTypeLabel(file('automatic-backup-cron'))).toBe(
            'Sauvegarde automatique (cron)'
        );
        expect(backupTypeLabel(file('safety-backup-reset'))).toBe('Sauvegarde avant effacement');
    });
});
