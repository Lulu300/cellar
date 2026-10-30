import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { openDatabase } from '#lib/server/db/connection.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { restore } from '../../../../test/restore';
import { buildZip } from '../../../../test/zip';

/** The bytes of a SQLite file that `build` fills. */
function sqliteFile(build: (sqlite: ReturnType<typeof openDatabase>['$client']) => void): Buffer {
    const file = path.join(DATA_DIR, `scratch-${Math.random().toString(36).slice(2)}.db`);
    const { $client: sqlite } = openDatabase(file);
    build(sqlite);
    sqlite.close();
    const bytes = readFileSync(file);
    rmSync(file);
    return bytes;
}

/** A database whose pages no longer match: past the header, but not the integrity check. */
function damagedDatabase(): Buffer {
    const bytes = sqliteFile((sqlite) => {
        sqlite.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)');
        const insert = sqlite.prepare('INSERT INTO notes (text) VALUES (?)');
        for (let index = 0; index < 500; index++) insert.run(`note ${index}`.repeat(20));
    });
    const pageSize = bytes.readUInt16BE(16);
    // The middle of a leaf page of the table: rows that no longer parse.
    bytes.fill(0xff, pageSize * 3 + 100, pageSize * 3 + 600);
    return bytes;
}

const zipFile = (bytes: BlobPart) =>
    new File([bytes], 'cellar-backup-test.zip', { type: 'application/zip' });

describe('POST /api/admin/restore with a file that is not a Cellar backup', () => {
    beforeAll(async () => {
        const now = new Date();
        await db
            .insert(countries)
            .values({ id: 'es', name: 'Spain', createdAt: now, updatedAt: now });
    });

    it.each([
        [
            'a zip without cellar.db',
            [{ name: 'notes.txt', data: Buffer.from('hello') }],
            /no cellar\.db/,
            'no_database'
        ],
        [
            'an empty cellar.db',
            [{ name: 'cellar.db', data: Buffer.alloc(0) }],
            /not a SQLite/,
            'not_sqlite'
        ],
        [
            'a cellar.db that is not a database',
            [{ name: 'cellar.db', data: Buffer.from('not a database at all') }],
            /not a SQLite/,
            'not_sqlite'
        ],
        [
            'an empty SQLite database',
            [
                {
                    name: 'cellar.db',
                    data: sqliteFile((sqlite) => sqlite.pragma('user_version = 1'))
                }
            ],
            /not a Cellar database: it lacks app_settings, countries/,
            'not_cellar'
        ],
        [
            'the SQLite database of another program',
            [
                {
                    name: 'cellar.db',
                    data: sqliteFile((sqlite) => sqlite.exec('CREATE TABLE notes (text TEXT)'))
                }
            ],
            /not a Cellar database/,
            'not_cellar'
        ],
        [
            'a damaged database',
            [{ name: 'cellar.db', data: damagedDatabase() }],
            /damaged|cannot be read/,
            'damaged'
        ]
    ])(
        'refuses %s with 422, before changing or writing anything',
        async (_, entries, reason, problem) => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const response = await restore(zipFile(new Uint8Array(buildZip(entries))));
            consoleError.mockRestore();

            expect(response.status).toBe(422);
            const { error } = await response.json();
            expect(error).toMatchObject({ code: 'invalid_backup', details: { problem } });
            expect(error.message).toMatch(reason);
            expect((await db.select().from(countries)).map((country) => country.name)).toEqual([
                'Spain'
            ]);
            // No pre-restore backup, and no temporary file left.
            expect(readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'))).toEqual(
                []
            );
        }
    );

    it.each([
        ['a file that is not a zip', zipFile('just some text')],
        ['an empty body', zipFile('')],
        // A download cut short: the end of the zip, its central directory, is missing.
        [
            'a truncated backup',
            zipFile(
                new Uint8Array(buildZip([{ name: 'cellar.db', data: randomBytes(4096) }])).slice(
                    0,
                    2048
                )
            )
        ]
    ])('refuses %s with the problem unreadable_zip, and changes nothing', async (_, file) => {
        const response = await restore(file);

        expect(response.status).toBe(422);
        expect((await response.json()).error.details.problem).toBe('unreadable_zip');
        expect((await db.select().from(countries)).map((country) => country.name)).toEqual([
            'Spain'
        ]);
        expect(readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'))).toEqual([]);
    });

    it('keeps a damaged backup of the list that it refuses to restore', async () => {
        const name = 'cellar-backup-damaged.zip';
        writeFileSync(path.join(DATA_DIR, name), 'not a zip');

        const response = await restore({ filename: name });

        expect(response.status).toBe(422);
        expect(readFileSync(path.join(DATA_DIR, name), 'utf8')).toBe('not a zip');
        expect(readdirSync(DATA_DIR).filter((file) => !file.startsWith('cellar.db'))).toEqual([
            name
        ]);
        rmSync(path.join(DATA_DIR, name));
    });
});
