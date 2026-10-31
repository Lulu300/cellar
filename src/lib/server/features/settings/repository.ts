import { eq } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { appSettings, type AppSetting } from '#lib/server/db/schema.js';

export function getAppSetting(key: string, tx: Tx = db): AppSetting | undefined {
    return tx.select().from(appSettings).where(eq(appSettings.key, key)).limit(1).get();
}

/** Saves a setting, creating it if needed. Synchronous, so that it can run in a transaction. */
export function setAppSetting(key: string, value: string, tx: Tx = db): AppSetting {
    return tx
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
        .returning()
        .get();
}

/** Saves several settings, all or none. */
export function setAppSettings(values: Record<string, string>, tx: Tx = db): void {
    tx.transaction((tx) => {
        for (const [key, value] of Object.entries(values)) setAppSetting(key, value, tx);
    });
}

/**
 * Inserts the setting unless it exists. Returns whether it was inserted: the unique key makes
 * every insert but one fail, even when several race.
 */
export function insertAppSettingIfMissing(key: string, value: string, tx: Tx = db): boolean {
    const inserted = tx
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoNothing({ target: appSettings.key })
        .returning()
        .all();
    return inserted.length > 0;
}

export function deleteAppSetting(key: string, tx: Tx = db): void {
    tx.delete(appSettings).where(eq(appSettings.key, key)).run();
}

/**
 * Sets the setting to `value`, or removes it when `value` is undefined: for a restore to put back,
 * in its staged copy, the settings that belong to the instance rather than to the backup.
 */
export function putBackAppSetting(key: string, value: string | undefined, tx: Tx): void {
    if (value === undefined) deleteAppSetting(key, tx);
    else setAppSetting(key, value, tx);
}

/** The values of settings as they are stored, a missing one as undefined, for putBackAppSettings. */
export type StoredAppSettings = Record<string, string | undefined>;

export function getStoredAppSettings(keys: readonly string[]): StoredAppSettings {
    return Object.fromEntries(keys.map((key) => [key, getAppSetting(key)?.value]));
}

/** putBackAppSetting for each of the settings that getStoredAppSettings read. */
export function putBackAppSettings(stored: StoredAppSettings, tx: Tx): void {
    for (const [key, value] of Object.entries(stored)) putBackAppSetting(key, value, tx);
}

/** Every setting whose key starts with `prefix`. */
export function getAppSettingsStartingWith(prefix: string, tx: Tx = db): AppSetting[] {
    return tx
        .select()
        .from(appSettings)
        .all()
        .filter(({ key }) => key.startsWith(prefix));
}
