import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { producerKey, tidyName } from '#lib/shared/names.js';
import * as schema from './schema';

/**
 * Opens a database file (or `:memory:`) with the settings the app relies on, and does nothing else:
 * the tests use it to build the databases of other versions.
 */
export function openDatabase(filename: string) {
    const sqlite = new Database(filename);
    try {
        // Readers no longer block the writer, and the reverse.
        sqlite.pragma('journal_mode = WAL');
        // better-sqlite3 13 already sets these two; stated here so that the app does not depend
        // on its defaults: wait for a lock held by another process, such as the sqlite3 shell,
        // instead of failing at once with SQLITE_BUSY, and enforce the foreign keys.
        sqlite.pragma('busy_timeout = 5000');
        sqlite.pragma('foreign_keys = ON');
        // Deleted and replaced values are zeroed instead of lingering in the free space of the
        // file, which backups copy: the access code stored in clear before 0.2.0 must really leave
        // it once hashed.
        sqlite.pragma('secure_delete = ON');
    } catch (error) {
        // A file that is not a database fails here, such as one in a backup being restored.
        sqlite.close();
        throw error;
    }
    return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof openDatabase>;

/**
 * The connection or a transaction on it. Data-access functions that write take one, `db` by
 * default, so that a caller can make several of them a single transaction. better-sqlite3 runs a
 * transaction synchronously: its queries end with .run(), .all() or .get(), never with await.
 */
export type Tx = BaseSQLiteDatabase<'sync', Database.RunResult, typeof schema>;

/**
 * Applies the migrations that `database` lacks; the tests pass an older set of migrations. Drizzle
 * applies them in one transaction: when one fails, none is applied. So does one that leaves a row
 * pointing to a row that does not exist. Drizzle does not say which one failed: the message names
 * every migration that was pending.
 */
export function migrateSchema(database: Db, migrationsFolder = './drizzle'): void {
    const sqlite = database.$client;
    const pending = pendingMigrations(sqlite, migrationsFolder);
    // Most starts: the foreign-key check below would read every table for nothing.
    if (pending.length === 0) return;
    // SQLite changes a constraint by recreating the table, and dropping the old one deletes its
    // rows first, which fires the ON DELETE actions of the tables that refer to it: their links
    // would be cleared, or the drop refused. The pragma does nothing inside a transaction, such as
    // the one Drizzle runs the migrations in, so it is turned off before.
    sqlite.pragma('foreign_keys = OFF');
    // Migration 0023 groups the producer names typed on wines as the app compares them, which
    // SQLite cannot do: its lower() leaves accented letters as they are.
    sqlite.function('cellar_producer_key', { deterministic: true }, producerKey);
    sqlite.function('cellar_tidy_name', { deterministic: true }, tidyName);
    try {
        refuseBrokenForeignKeys(sqlite);
        migrate(database, { migrationsFolder });
    } catch (error) {
        // Drizzle's message quotes the statement, and SQLite's reason is in its cause.
        const reasons = [];
        for (let cause = error; cause instanceof Error; cause = cause.cause) {
            reasons.push(cause.message);
        }
        const reason = reasons.join(': ').replace(/\s+/g, ' ');
        // eslint-disable-next-line preserve-caught-error -- every cause's message is in this one, on one line; the causes and their stacks would bury it in the logs
        throw new Error(
            `Database migration failed, nothing was applied (pending migrations: ${pending.join(', ')}): ${reason}`
        );
    } finally {
        sqlite.exec(`DROP TRIGGER IF EXISTS temp.${FOREIGN_KEY_GUARD}`);
        // SQLite cannot unregister a function: this frees the guard and the links it compared.
        sqlite.function(FOREIGN_KEY_GUARD, () => null);
        sqlite.pragma('foreign_keys = ON');
    }
}

/**
 * The tags of the migrations in `migrationsFolder` that Drizzle would apply: those its journal
 * dates after the last one recorded in the database.
 */
function pendingMigrations(sqlite: Database.Database, migrationsFolder: string): string[] {
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    const journal: { entries: { when: number; tag: string }[] } = JSON.parse(
        readFileSync(journalPath, 'utf8')
    );
    const last = lastAppliedMigration(sqlite) ?? -Infinity;
    return journal.entries.filter((entry) => entry.when > last).map((entry) => entry.tag);
}

const FOREIGN_KEY_GUARD = 'refuse_broken_foreign_keys';

/** Whether Drizzle's migrations ever ran on the database: a new database has no such table. */
function hasMigrationsTable(sqlite: Database.Database): boolean {
    return (
        sqlite
            .prepare(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
            )
            .get() !== undefined
    );
}

/**
 * The journal date of the last migration applied to the database, as Drizzle records it; null when
 * no migration ever ran on it.
 */
export function lastAppliedMigration(sqlite: Database.Database): number | null {
    if (!hasMigrationsTable(sqlite)) return null;
    return sqlite.prepare('SELECT max(created_at) FROM __drizzle_migrations').pluck().get() as
        number | null;
}

/** The links that point to missing rows, as a JSON object of their row counts by kind of link. */
const BROKEN_LINKS = `SELECT json_group_object(link, n) FROM (
    SELECT "table" || ' -> ' || parent AS link, count(*) AS n
    FROM pragma_foreign_key_check GROUP BY link)`;

/**
 * With the foreign keys off, nothing stops a migration from leaving rows that point to nothing.
 * Drizzle records each migration in its table inside the transaction: this trigger refuses that
 * record, which rolls back every migration, when a kind of link (a table to the table it refers
 * to) has more broken links than before, and names those kinds. Links already broken, by a
 * database edited by hand, must not stop Cellar from starting. A new database has no such table
 * yet, and no rows whose links a migration could break. Counting is enough for our own migrations,
 * which are tested: one that repaired a link and broke another of the same kind would pass. A
 * migration that renamed a table with links already broken would be refused, as they would count
 * as a new kind.
 */
function refuseBrokenForeignKeys(sqlite: Database.Database): void {
    if (!hasMigrationsTable(sqlite)) return;
    const before: Record<string, number> = JSON.parse(
        sqlite.prepare(BROKEN_LINKS).pluck().get() as string
    );
    // Called by the trigger, which passes the links as they are then: a function cannot query the
    // database itself while SQLite runs the statement. Its exception aborts that statement.
    sqlite.function(FOREIGN_KEY_GUARD, (links) => {
        const added = Object.entries(JSON.parse(links as string) as Record<string, number>)
            .filter(([link, count]) => count > (before[link] ?? 0))
            .map(([link]) => link);
        if (added.length > 0) {
            throw new Error(
                `the migration leaves rows that refer to missing rows: ${added.join(', ')}`
            );
        }
        return null;
    });
    sqlite.exec(
        `CREATE TEMP TRIGGER ${FOREIGN_KEY_GUARD} BEFORE INSERT ON main.__drizzle_migrations
         BEGIN SELECT ${FOREIGN_KEY_GUARD}((${BROKEN_LINKS})); END`
    );
}
