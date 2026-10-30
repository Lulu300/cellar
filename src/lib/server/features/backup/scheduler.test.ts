import { chmodSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { PUT } from '../../../../routes/api/admin/backup-settings/+server';
import { getBackupSettings, reschedule } from './scheduler';

const HOUR = 60 * 60 * 1000;

const automaticFiles = () =>
    readdirSync(DATA_DIR).filter((name) => /^cellar-(backup|export)-auto-internal-/.test(name));

/** Saves the settings through the route, as the admin page does. */
async function saveSettings(settings: { enabled: boolean; intervalHours: number; mode?: string }) {
    const response = await PUT(
        fakeEvent<Parameters<typeof PUT>[0]>({
            method: 'PUT',
            path: '/api/admin/backup-settings',
            routeId: '/api/admin/backup-settings',
            body: {
                autoBackupEnabled: settings.enabled,
                autoBackupInterval: settings.intervalHours,
                autoBackupKeepCount: 7,
                autoBackupMode: settings.mode ?? 'internal'
            }
        })
    );
    expect(response.status).toBe(200);
}

/** How many times the scheduler planned a backup: it does once a backup has ended. */
const plannedBackups = () =>
    vi.mocked(console.log).mock.calls.filter(([message]) => /Next automatic backup/.test(message))
        .length;

/** Moves the clock by `ms`, then waits for the backup due by then to end and the next one to be planned. */
async function runDueBackup(ms = 0) {
    const planned = plannedBackups();
    await vi.advanceTimersByTimeAsync(ms);
    await vi.waitFor(() => expect(plannedBackups()).toBeGreaterThan(planned), { timeout: 5000 });
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const name of automaticFiles()) rmSync(path.join(DATA_DIR, name));
    setAppSetting('auto_backup_enabled', 'false');
});

afterEach(async () => {
    setAppSetting('auto_backup_enabled', 'false');
    reschedule();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('the automatic backup scheduler', () => {
    it('applies a new interval at once, without a restart', async () => {
        setAppSetting('last_auto_backup', new Date(Date.now() - 3 * HOUR).toISOString());
        await saveSettings({ enabled: true, intervalHours: 24 });
        await vi.advanceTimersByTimeAsync(HOUR);
        expect(automaticFiles()).toEqual([]);

        // The last backup is 4 hours old: with a 2-hour interval, the next one is overdue.
        const savedAt = Date.now();
        await saveSettings({ enabled: true, intervalHours: 2 });
        await runDueBackup();

        expect(automaticFiles()).toHaveLength(2);
        const lastBackup = Date.parse(getBackupSettings().lastBackup);
        expect(lastBackup).toBeGreaterThanOrEqual(savedAt);
        // Then every 2 hours.
        await vi.advanceTimersByTimeAsync(lastBackup + 2 * HOUR - 1 - Date.now());
        expect(automaticFiles()).toHaveLength(2);
        await runDueBackup(1);
        expect(automaticFiles()).toHaveLength(4);
    });

    it('stops backing up as soon as backups are disabled or left to a cron job', async () => {
        setAppSetting('last_auto_backup', new Date(Date.now() - HOUR).toISOString());
        await saveSettings({ enabled: true, intervalHours: 2 });

        await saveSettings({ enabled: true, intervalHours: 2, mode: 'cron' });
        await vi.advanceTimersByTimeAsync(3 * HOUR);
        await saveSettings({ enabled: false, intervalHours: 2 });
        await vi.advanceTimersByTimeAsync(3 * HOUR);

        expect(automaticFiles()).toEqual([]);
    });

    it('waits one interval after a failed backup instead of trying again at once', async () => {
        const locked = path.join(IMAGES_DIR, 'locked.jpg');
        writeFileSync(locked, 'label bytes');
        chmodSync(locked, 0o000);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            setAppSetting('last_auto_backup', '');
            await saveSettings({ enabled: true, intervalHours: 1 });
            await runDueBackup(HOUR);
            expect(error).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(HOUR / 2);
            expect(error).toHaveBeenCalledTimes(1);
        } finally {
            rmSync(locked);
        }
        await runDueBackup(HOUR / 2);
        expect(automaticFiles()).toHaveLength(2);
    });
});
