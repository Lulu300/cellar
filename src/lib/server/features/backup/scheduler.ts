import type { Tx } from '#lib/server/db/connection.js';
import {
    getAppSetting,
    getStoredAppSettings,
    putBackAppSettings,
    setAppSetting,
    type StoredAppSettings
} from '#lib/server/features/settings/repository.js';
import { createExportZip } from '#lib/server/features/backup/export.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { backupTimestamp, createBackupZip } from './archive';
import { applyRetention, automaticFileName, type AutomaticSource } from './files';

export const BACKUP_SETTING_KEYS = {
    enabled: 'auto_backup_enabled',
    intervalHours: 'auto_backup_interval',
    keepCount: 'auto_backup_keep_count',
    mode: 'auto_backup_mode',
    lastBackup: 'last_auto_backup'
};

export const BACKUP_MODES = ['internal', 'cron'] as const;
export type BackupMode = (typeof BACKUP_MODES)[number];

export const INTERVAL_HOURS = { min: 1, max: 168, default: 24 };
export const KEEP_COUNT = { min: 1, max: 50, default: 7 };

function isInRange(value: unknown, range: { min: number; max: number }): value is number {
    return (
        Number.isInteger(value) && (value as number) >= range.min && (value as number) <= range.max
    );
}

export interface BackupSettings {
    enabled: boolean;
    intervalHours: number;
    keepCount: number;
    mode: BackupMode;
    /** ISO date of the last automatic backup, or '' before the first one. */
    lastBackup: string;
}

/** The stored settings, with the default of any value missing or invalid. */
export function getBackupSettings(): BackupSettings {
    const read = (key: string) => getAppSetting(key)?.value;
    const number = (key: string, range: typeof INTERVAL_HOURS) => {
        const value = Number(read(key));
        return isInRange(value, range) ? value : range.default;
    };
    const mode = read(BACKUP_SETTING_KEYS.mode);
    return {
        enabled: read(BACKUP_SETTING_KEYS.enabled) === 'true',
        intervalHours: number(BACKUP_SETTING_KEYS.intervalHours, INTERVAL_HOURS),
        keepCount: number(BACKUP_SETTING_KEYS.keepCount, KEEP_COUNT),
        mode: mode === 'cron' ? 'cron' : 'internal',
        lastBackup: read(BACKUP_SETTING_KEYS.lastBackup) ?? ''
    };
}

/** The stored values of the settings, as they are, for putBackBackupSettings. */
export function storedBackupSettings(): StoredAppSettings {
    return getStoredAppSettings(Object.values(BACKUP_SETTING_KEYS));
}

/**
 * Like the cron token, the settings belong to the instance, not to the data: after a restore,
 * automatic backups go on as before it, whatever mode the backup was taken in.
 */
export function putBackBackupSettings(staged: Tx, stored: StoredAppSettings): void {
    putBackAppSettings(stored, staged);
}

/**
 * Writes an automatic backup and an automatic export, then deletes the oldest ones beyond the
 * number to keep. Returns the names of the two files.
 */
export async function runAutomaticBackup(source: AutomaticSource) {
    const startedAt = new Date();
    const timestamp = backupTimestamp(startedAt);
    const backup = automaticFileName('backup', source, timestamp);
    const exportFile = automaticFileName('export', source, timestamp);

    await createBackupZip(`${DATA_DIR}/${backup}`);
    await createExportZip(`${DATA_DIR}/${exportFile}`, 'automatic-export');
    setAppSetting(BACKUP_SETTING_KEYS.lastBackup, startedAt.toISOString());

    const { keepCount } = getBackupSettings();
    await applyRetention('backup', keepCount);
    await applyRetention('export', keepCount);
    console.log(`🗄️  Automatic backup (${source}) created:`, backup);
    return { backup, export: exportFile };
}

const HOUR = 60 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;
let running = false;
// In memory: after a failed backup, the next attempt waits one interval instead of starting again
// at once, and after a restart it is due at once.
let lastFailure = 0;

/**
 * Plans the next automatic backup from the current settings, replacing the planned one: called at
 * startup, and whenever the settings or the database change. A backup that is due runs now.
 */
export function reschedule(): void {
    clearTimeout(timer);
    timer = undefined;
    // The running backup calls this again when it ends.
    if (running) return;

    const settings = getBackupSettings();
    if (!settings.enabled || settings.mode !== 'internal') {
        console.log('📅 No automatic backup planned (disabled, or left to a cron job)');
        return;
    }

    const interval = settings.intervalHours * HOUR;
    const last = Math.max(Date.parse(settings.lastBackup) || 0, lastFailure);
    const now = Date.now();
    // Never further than one interval away, should the last backup bear a date in the future.
    const delay = last ? Math.min(Math.max(last + interval - now, 0), interval) : interval;
    timer = setTimeout(runScheduledBackup, delay);
    // A pending timer keeps Node alive after adapter-node closes the server on SIGTERM, so without
    // unref() `docker stop` would end with SIGKILL.
    timer.unref();
    console.log(`📅 Next automatic backup: ${new Date(now + delay).toLocaleString()}`);
}

async function runScheduledBackup(): Promise<void> {
    running = true;
    try {
        await runAutomaticBackup('internal');
    } catch (error) {
        lastFailure = Date.now();
        console.error('❌ The automatic backup failed:', error);
    } finally {
        running = false;
        reschedule();
    }
}
