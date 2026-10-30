import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { migrateSchema, openDatabase } from '#lib/server/db/connection.js';
import { scratchFolder } from './scratch.js';

/**
 * A database migrated with `migrationsFolder` only, such as the one of an older version (see
 * migrationsBefore). setup.ts only lets it be `:memory:` or a file in the test's scratch folder.
 */
export function openOldDatabase(filename: string, migrationsFolder: string) {
    const database = openDatabase(filename);
    migrateSchema(database, migrationsFolder);
    return database;
}

/** The country names in a database file, such as the one in a backup. */
export function countryNamesInDbFile(filename: string): string[] {
    const { $client: sqlite } = openDatabase(filename);
    try {
        return sqlite.prepare('SELECT name FROM countries').pluck().all() as string[];
    } finally {
        sqlite.close();
    }
}

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: true };

/** A copy of the migrations, whose journal `edit` changes. */
function copyMigrations(edit: (entries: JournalEntry[], folder: string) => JournalEntry[]): string {
    const folder = scratchFolder('migrations-');
    cpSync('drizzle', folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = edit(journal.entries, folder);
    writeFileSync(journalPath, JSON.stringify(journal));
    return folder;
}

/** A copy of the migrations that stops before `tag`, to build the database of an older version. */
export function migrationsBefore(tag: string): string {
    return copyMigrations((entries) => {
        const end = entries.findIndex((entry) => entry.tag === tag);
        if (end === -1) throw new Error(`No migration named ${tag}`);
        return entries.slice(0, end);
    });
}

/** A copy of the migrations followed by `added`, in this order, such as a broken one. */
export function migrationsWith(added: { tag: string; sql: string }[]): string {
    return copyMigrations((entries, folder) => {
        const last = entries[entries.length - 1];
        return [
            ...entries,
            ...added.map(({ tag, sql }, index) => {
                writeFileSync(path.join(folder, `${tag}.sql`), sql);
                const position = index + 1;
                return { ...last, idx: last.idx + position, when: last.when + position, tag };
            })
        ];
    });
}
