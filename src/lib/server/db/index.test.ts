import * as fs from 'node:fs';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appellations, appSettings, countries, labelPresets, regions, wineTypes } from './schema';
import { db, migrateSchema, prepareDatabase, replaceDatabaseFile } from '#lib/server/db/index.js';
import { openDatabase } from '#lib/server/db/connection.js';
import { migrationsBefore, openOldDatabase } from '../../../test/database';
import { CSV_IMPORTS_DIR, DATA_DIR, DATABASE_PATH } from '#lib/server/paths.js';
import { exitUnlessDirsWritable } from '#lib/server/writable-dirs.js';

// Wrapped so that a test can make one call fail, as a full disk would.
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        copyFileSync: vi.fn(actual.copyFileSync),
        renameSync: vi.fn(actual.renameSync)
    };
});

// Counted: getDb() runs it before opening, and a restore must reopen without it, since it may stop
// the process in the middle of the request.
vi.mock('#lib/server/writable-dirs.js', () => ({ exitUnlessDirsWritable: vi.fn() }));

const timestamps = { createdAt: new Date(), updatedAt: new Date() };

/** A sound database file holding France, to restore. */
function backupFile(): string {
    const file = path.join(DATA_DIR, `backup-${Math.random().toString(36).slice(2)}.db`);
    const database = openDatabase(file);
    migrateSchema(database);
    database
        .insert(countries)
        .values({ id: 'fr', name: 'France', ...timestamps })
        .run();
    database.$client.close();
    return file;
}

async function countryNames() {
    return (await db.select().from(countries)).map((country) => country.name);
}

const nothingToPrepare = async () => {};

const noSpace = () =>
    Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });

describe('replaceDatabaseFile', () => {
    // A backup restored by an earlier test may hold regions, which keep their country.
    beforeEach(async () => {
        await db.delete(regions);
        await db.delete(countries);
    });

    it('leaves the live database whole and served when the copy fails halfway', async () => {
        await db.insert(countries).values({ id: 'es', name: 'Spain', ...timestamps });
        vi.mocked(fs.copyFileSync).mockImplementationOnce((source, destination) => {
            writeFileSync(destination, readFileSync(source).subarray(0, 4096));
            throw noSpace();
        });

        await expect(replaceDatabaseFile(backupFile(), nothingToPrepare)).rejects.toThrow(/ENOSPC/);

        expect(await countryNames()).toEqual(['Spain']);
        expect(existsSync(`${DATABASE_PATH}.restore`)).toBe(false);
    });

    it('reopens the live database when the swap fails', async () => {
        await db.insert(countries).values({ id: 'es', name: 'Spain', ...timestamps });
        vi.mocked(fs.renameSync).mockImplementationOnce(() => {
            throw noSpace();
        });
        vi.mocked(exitUnlessDirsWritable).mockClear();

        await expect(replaceDatabaseFile(backupFile(), nothingToPrepare)).rejects.toThrow(/ENOSPC/);

        expect(await countryNames()).toEqual(['Spain']);
        // Reopened by the restore itself, not later by getDb().
        expect(exitUnlessDirsWritable).not.toHaveBeenCalled();
        expect(existsSync(`${DATABASE_PATH}.restore`)).toBe(false);
    });

    it('does not let a WAL file left by the replaced database reach the new one', async () => {
        // Another connection, like the sqlite3 shell, keeps the WAL file alive after the app
        // closes its own; no automatic checkpoint empties it meanwhile.
        const other = openDatabase(DATABASE_PATH).$client;
        other.pragma('wal_autocheckpoint = 0');
        db.$client.pragma('wal_autocheckpoint = 0');
        for (let index = 0; index < 50; index++) {
            await db
                .insert(countries)
                .values({ id: `c${index}`, name: `Old ${index}`, ...timestamps });
        }
        other.exec('BEGIN');
        other.prepare('SELECT count(*) FROM countries').get();

        try {
            await replaceDatabaseFile(backupFile(), nothingToPrepare);

            expect(await countryNames()).toEqual(['France']);
            expect(db.$client.pragma('integrity_check', { simple: true })).toBe('ok');
        } finally {
            other.exec('COMMIT');
            other.close();
        }
        expect(await countryNames()).toEqual(['France']);
        expect(db.$client.pragma('integrity_check', { simple: true })).toBe('ok');
    });

    it('does not let the WAL file of a stopped restore reach the next one', async () => {
        // A restore killed while it migrated its copy: the copy's WAL file stays behind.
        const staged = `${DATABASE_PATH}.restore`;
        const stopped = openDatabase(staged);
        migrateSchema(stopped);
        stopped.$client.pragma('wal_autocheckpoint = 0');
        stopped
            .insert(countries)
            .values({ id: 'stale', name: 'From the stopped restore', ...timestamps })
            .run();
        const staleWal = readFileSync(`${staged}-wal`);
        stopped.$client.close();
        writeFileSync(`${staged}-wal`, staleWal);

        await replaceDatabaseFile(backupFile(), nothingToPrepare);

        expect(await countryNames()).toEqual(['France']);
        expect(existsSync(`${staged}-wal`)).toBe(false);
    });

    // Every request reads the sessions table, which a backup made before 0.2.0 lacks.
    it('migrates a backup made by an older version', async () => {
        const migrationsFolder = migrationsBefore('0003_modern_caretaker');
        const file = path.join(DATA_DIR, 'backup-before-sessions.db');
        openOldDatabase(file, migrationsFolder).$client.close();
        rmSync(migrationsFolder, { recursive: true, force: true });

        await replaceDatabaseFile(file, nothingToPrepare);

        expect(db.$client.prepare('SELECT count(*) FROM sessions').pluck().get()).toBe(0);
    });

    it('leaves the live database whole and served when the backup cannot be migrated', async () => {
        await db.insert(countries).values({ id: 'es', name: 'Spain', ...timestamps });
        // Sound, but the first migration cannot create a table that it already holds.
        const file = path.join(DATA_DIR, 'backup-not-migratable.db');
        openDatabase(file).$client.exec('CREATE TABLE countries (name text)').close();

        await expect(replaceDatabaseFile(file, nothingToPrepare)).rejects.toThrow(
            /Database migration failed/
        );

        expect(await countryNames()).toEqual(['Spain']);
        expect(existsSync(`${DATABASE_PATH}.restore`)).toBe(false);
    });

    it('puts the backup in place when nothing fails', async () => {
        await replaceDatabaseFile(backupFile(), nothingToPrepare);

        expect(await countryNames()).toEqual(['France']);
    });

    // Up to 0.5.0, nothing stopped a country from having two regions of the same name.
    it('restores a backup of an older version that the constraints refuse as it is', async () => {
        const migrationsFolder = migrationsBefore('0006_constraints_and_indexes');
        const file = path.join(DATA_DIR, 'backup-with-duplicates.db');
        const backup = openOldDatabase(file, migrationsFolder);
        backup.$client.exec(`
            INSERT INTO countries VALUES ('fr', 'France', 0, 0);
            INSERT INTO regions VALUES ('bdx', 'Bordeaux', 'fr', 0, 0), ('bdx2', 'Bordeaux', 'fr', 0, 0);
        `);
        backup.$client.close();
        rmSync(migrationsFolder, { recursive: true, force: true });

        await replaceDatabaseFile(file, nothingToPrepare);

        expect(db.$client.prepare('SELECT id FROM regions').pluck().all()).toEqual(['bdx']);
    });

    it('prepares the migrated backup before it goes live', async () => {
        await db.insert(countries).values({ id: 'es', name: 'Spain', ...timestamps });
        let servedWhilePreparing: string[] = [];

        await replaceDatabaseFile(backupFile(), async (staged) => {
            servedWhilePreparing = await countryNames();
            // Such as the sessions of the backup's day: never served.
            staged
                .insert(countries)
                .values({ id: 'pt', name: 'Portugal', ...timestamps })
                .run();
        });

        expect(servedWhilePreparing).toEqual(['Spain']);
        expect((await countryNames()).sort()).toEqual(['France', 'Portugal']);
    });

    it('leaves the live database whole and served when the preparation fails', async () => {
        await db.insert(countries).values({ id: 'es', name: 'Spain', ...timestamps });

        await expect(
            replaceDatabaseFile(backupFile(), async () => {
                throw new Error('preparation failed');
            })
        ).rejects.toThrow('preparation failed');

        expect(await countryNames()).toEqual(['Spain']);
        expect(existsSync(`${DATABASE_PATH}.restore`)).toBe(false);
    });
});

describe('prepareDatabase', () => {
    const settingKeys = async () =>
        (await db.select().from(appSettings)).map((setting) => setting.key);
    const csvFile = (name: string) => path.join(CSV_IMPORTS_DIR, name);

    // Reference data, not schema: 0.5.0 served without it too, and the user can fix the files.
    it('seeds what it can, names every broken CSV file, and retries at the next start', async () => {
        writeFileSync(csvFile('wine_types.csv'), 'label\nRed\n');
        // Two fields instead of three. label_presets.csv comes after it.
        writeFileSync(csvFile('appellations.csv'), 'Pays;Region;Appellation\nFrance;Bordeaux\n');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        await prepareDatabase();

        expect(error).toHaveBeenCalledOnce();
        const [message] = error.mock.calls[0];
        expect(message).toContain(`in ${path.resolve(CSV_IMPORTS_DIR)}`);
        expect(message).toContain('wine_types.csv');
        expect(message).toContain('appellations.csv');
        expect(await db.select().from(labelPresets)).not.toHaveLength(0);
        expect(await settingKeys()).toContain('barcode_auto_generation');
        expect(await settingKeys()).not.toContain('initial_seeding_completed');

        // A deleted file is copied again from the defaults.
        rmSync(csvFile('wine_types.csv'));
        rmSync(csvFile('appellations.csv'));
        await prepareDatabase();

        expect(existsSync(csvFile('wine_types.csv'))).toBe(true);
        expect(existsSync(csvFile('appellations.csv'))).toBe(true);
        expect(await settingKeys()).toContain('initial_seeding_completed');
        expect(await db.select().from(wineTypes)).not.toHaveLength(0);
        expect(await db.select().from(appellations)).not.toHaveLength(0);
        error.mockRestore();
    });

    // So that the upgrade check records the version of a start stopped during a long seeding.
    it('runs its afterMigrations step right after the migrations, before the seeding', async () => {
        // So that the seeding runs again, and logs.
        db.delete(appSettings).where(eq(appSettings.key, 'initial_seeding_completed')).run();
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        await prepareDatabase(() => console.log('after migrations'));

        const lines = log.mock.calls.map(([line]) => line);
        const seeding = lines.indexOf('🌱 Seeding the default data from the CSV files...');
        expect(lines.indexOf('after migrations')).toBe(
            lines.indexOf('✅ Schema migrations completed') + 1
        );
        expect(seeding).toBeGreaterThan(lines.indexOf('after migrations'));
        log.mockRestore();
    });
});

// Last: it loads a second copy of the module.
describe('the database', () => {
    it('opens on first use, not when its module loads', async () => {
        const databasePath = path.join(DATA_DIR, 'opened-on-first-use.db');
        vi.stubEnv('DATABASE_PATH', databasePath);
        vi.doUnmock('#lib/server/db/index.js');
        vi.resetModules();

        const { getDb } = await import('#lib/server/db/index.js');
        expect(existsSync(databasePath)).toBe(false);

        getDb();
        expect(existsSync(databasePath)).toBe(true);
        vi.unstubAllEnvs();
    });
});
