import { chmodSync, copyFileSync, renameSync, rmSync } from 'node:fs';
import { migrateSchema, openDatabase, type Db } from './connection';
import { seed } from './seed';
import { getStoredAccessCode, hashPlaintextAccessCode } from '#lib/server/access-code.js';
import { announceSetupToken } from '#lib/server/setup-token.js';
import { exitUnlessDirsWritable } from '#lib/server/writable-dirs.js';
import { DATABASE_PATH } from '#lib/server/paths.js';

let connection: Db | null = null;

/** The copy of a database being restored, next to the app's. */
const STAGED_DATABASE_PATH = `${DATABASE_PATH}.restore`;

/**
 * Removes the copy of a database being restored, with the files SQLite keeps next to it: a WAL file
 * left by a stopped restore would be applied to the copy of the next one, which would then restore
 * the stopped restore's data.
 */
export function removeStagedDatabase(): void {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
        rmSync(STAGED_DATABASE_PATH + suffix, { force: true });
    }
}

/**
 * The connection of the app, opened on first use rather than when this module loads: the build
 * imports the server modules, and must not create a database.
 */
export function getDb(): Db {
    if (!connection) {
        // In a folder or on a cellar.db the app cannot write to, SQLite fails with a bare error or
        // silently opens read-only, and the migrations fail later. Missing folders are created.
        exitUnlessDirsWritable();
        connection = openDatabase(DATABASE_PATH);
    }
    return connection;
}

/**
 * The connection of the app, for the modules that import it once: it follows getDb(), so it reaches
 * the new database after a restore. Only property reads go through it (no `in`, no spreading), and a
 * query built before a restore must not run after it.
 */
export const db = new Proxy({} as Db, {
    get(_, property) {
        const current = getDb();
        const value = Reflect.get(current, property, current);
        return typeof value === 'function' ? value.bind(current) : value;
    }
});

/**
 * Puts a migrated copy of the database file `source` in place of the app's database, then reopens
 * it. `prepare` runs on the migrated copy before it goes live, so that nothing it removes, such as
 * the sessions of the backup's day, is ever served. Throws, leaving the app's database as it was,
 * when `source` cannot be migrated or `prepare` fails. The caller checks that `source` is a sound
 * Cellar database first.
 */
export async function replaceDatabaseFile(
    source: string,
    prepare: (staged: Db) => Promise<void>
): Promise<void> {
    // Copied next to the database first, so that a failed copy, on a full disk for example, leaves
    // the live file whole; the rename then swaps the files at once.
    const staged = STAGED_DATABASE_PATH;
    removeStagedDatabase();
    try {
        copyFileSync(source, staged);
        chmodSync(staged, 0o644); // rw-r--r--
        // Before the swap: a backup that the migrations fail on must not become the live database,
        // which the next start would refuse to serve.
        const copy = openDatabase(staged);
        try {
            migrateSchema(copy);
            await prepare(copy);
        } finally {
            copy.$client.close();
        }
        // Synchronous from here, so that no request can reopen the database, or write to it,
        // while its file is being replaced.
        connection?.$client.close();
        connection = null;
        renameSync(staged, DATABASE_PATH);
        // Closing checkpoints and removes them; should one remain, SQLite would apply the replaced
        // database's pages to the new file.
        for (const suffix of ['-wal', '-shm']) rmSync(DATABASE_PATH + suffix, { force: true });
    } finally {
        try {
            // Never left closed: after a failure, this reopens the database that was not replaced.
            // Not getDb(): the folder check that it runs first may stop the process, which must
            // not happen in the middle of a request.
            connection ??= openDatabase(DATABASE_PATH);
        } finally {
            removeStagedDatabase();
        }
    }
}

/**
 * Brings the database up to date when the server starts, before it serves anything: the schema
 * migrations, then `afterMigrations`, then the access code and the reference data of a first
 * start. Throws when one of the first three fails.
 */
export async function prepareDatabase(afterMigrations?: () => void): Promise<void> {
    console.log('🔄 Running database migrations...');
    migrateSchema(db);
    console.log('✅ Schema migrations completed');
    afterMigrations?.();

    await hashPlaintextAccessCode(db);
    if ((await getStoredAccessCode(db)) === undefined) announceSetupToken();

    try {
        seed(db);
    } catch (error) {
        // Reference data, not schema: the app serves without it, as 0.5.0 did. The seeding is
        // not marked complete, so the next start tries again.
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
            `❌ Some reference data could not be seeded: Cellar starts without it, and tries again at its next start. ${reason}`
        );
    }
}

export { migrateSchema };
