import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, countries, sessions, type Session } from '#lib/server/db/schema.js';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { extractZip } from '#lib/server/zip.js';
import { ACCESS_CODE_KEY, getStoredAccessCode } from '#lib/server/access-code.js';
import { createSession } from '#lib/server/session.js';
import { fakeCookies } from '../../../../test/event';
import { countryNamesInDbFile, migrationsBefore, openOldDatabase } from '../../../../test/database';
import { jpegBytes } from '../../../../test/image';
import { backupZip, restore } from '../../../../test/restore';
import { buildZip } from '../../../../test/zip';

const timestamps = { createdAt: new Date(), updatedAt: new Date() };
const oldMigrations = migrationsBefore('0003_modern_caretaker');

afterAll(() => {
    rmSync(oldMigrations, { recursive: true, force: true });
});

/**
 * A backup made before the sessions table existed, holding France and a pre-0.2.0 plaintext code.
 * Its file is in rollback journal mode, like the backups made before WAL.
 */
async function oldBackupZip(): Promise<File> {
    const dbPath = path.join(DATA_DIR, 'old-backup.db');
    const database = openOldDatabase(dbPath, oldMigrations);
    await database.insert(countries).values({ id: 'fr', name: 'France', ...timestamps });
    database.$client
        .prepare(
            'INSERT INTO wine_images (id, filename, path, created_at, updated_at) VALUES (?, ?, ?, 0, 0)'
        )
        .run('label', 'label.jpg', '/uploads/wines/');
    await database
        .insert(appSettings)
        .values({ id: 'code', key: ACCESS_CODE_KEY, value: 'plaintext-code-4821', ...timestamps });
    database.$client.pragma('journal_mode = DELETE');
    database.$client.close();
    const zip = buildZip([
        { name: 'cellar.db', data: readFileSync(dbPath) },
        { name: 'images/label.jpg', data: jpegBytes('label bytes') },
        // What a restore leaves out: a file that is not an image, a hidden file, a subfolder.
        { name: 'images/notes.txt', data: Buffer.from('not an image') },
        { name: 'images/.DS_Store', data: jpegBytes('hidden') },
        { name: 'images/thumbs/', data: Buffer.alloc(0) },
        { name: 'images/thumbs/label.jpg', data: jpegBytes('thumbnail') }
    ]);
    return new File([new Uint8Array(zip)], 'cellar-backup-old.zip', { type: 'application/zip' });
}

describe('POST /api/admin/restore', () => {
    let admin: Session;
    let response: Response;
    let loggedErrors: unknown[][];

    beforeAll(async () => {
        // Rows of the replaced database, still in its WAL file when the restore starts.
        await db.insert(countries).values({ id: 'it', name: 'Italy', ...timestamps });
        await db
            .insert(appSettings)
            .values({ id: 'code', key: ACCESS_CODE_KEY, value: 'scrypt$live', ...timestamps });
        admin = await createSession(fakeCookies(), new URL('http://localhost'));
        const file = await oldBackupZip();
        const consoleError = vi.spyOn(console, 'error');
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        response = await restore(file, admin);
        // Copied now: Vitest clears the calls of every mock before each test.
        loggedErrors = [...consoleError.mock.calls];
        consoleError.mockRestore();
    });

    it('puts the backup in place of the open database, with its images', async () => {
        expect(response.status).toBe(200);
        expect((await response.clone().json()).restored).toEqual({ database: true, images: true });
        // Read through the `db` imported before the restore.
        expect((await db.select().from(countries)).map((country) => country.name)).toEqual([
            'France'
        ]);
        expect(readFileSync(path.join(IMAGES_DIR, 'label.jpg'))).toEqual(jpegBytes('label bytes'));
    });

    it('restores only the images the app accepts', () => {
        expect(readdirSync(IMAGES_DIR)).toEqual(['label.jpg']);
    });

    it('reopens the restored database in WAL mode', () => {
        expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal');
    });

    it('keeps the session and the access code of the replaced database', async () => {
        // Compared by token hash: the stored expiry loses the milliseconds of `admin`.
        expect((await db.select().from(sessions)).map(({ tokenHash }) => tokenHash)).toEqual([
            admin.tokenHash
        ]);
        expect(await getStoredAccessCode(db)).toBe('scrypt$live');
        // The plaintext code of the backup makes the route VACUUM the replaced file, which only
        // logs when it fails.
        expect(loggedErrors).toEqual([]);
    });

    it('first saves the replaced database in a backup, with the rows still in its WAL file', async () => {
        const { backup } = await response.clone().json();
        const extractDir = path.join(DATA_DIR, 'pre-restore');
        await extractZip(path.join(DATA_DIR, backup), extractDir, () => true);
        expect(countryNamesInDbFile(path.join(extractDir, 'cellar.db'))).toEqual(['Italy']);
    });
});

it('keeps the restored database when its images cannot be copied, and says so', async () => {
    // A folder where the image goes makes the copy fail.
    mkdirSync(path.join(IMAGES_DIR, 'blocked.jpg'));
    const file = backupZip(
        (backup) => {
            backup
                .insert(countries)
                .values({ id: 'es', name: 'Spain', ...timestamps })
                .run();
        },
        { extraEntries: [{ name: 'images/blocked.jpg', data: jpegBytes('label') }] }
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await restore(file);
    consoleError.mockRestore();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
        restored: { database: true, images: false },
        imagesCopyFailed: true
    });
    expect((await db.select().from(countries)).map((country) => country.name)).toEqual(['Spain']);
});

describe('POST /api/admin/restore with the name of a backup of the list', () => {
    const countryNames = async () => (await db.select().from(countries)).map(({ name }) => name);

    it('restores the backup where it is, and leaves it in the list', async () => {
        const name = 'cellar-backup-listed.zip';
        const file = backupZip((backup) => {
            backup
                .insert(countries)
                .values({ id: 'pt', name: 'Portugal', ...timestamps })
                .run();
        });
        const bytes = Buffer.from(await file.arrayBuffer());
        writeFileSync(path.join(DATA_DIR, name), bytes);

        const response = await restore({ filename: name });

        expect(response.status).toBe(200);
        expect(await countryNames()).toEqual(['Portugal']);
        expect(readFileSync(path.join(DATA_DIR, name))).toEqual(bytes);
        expect(readdirSync(DATA_DIR).filter((file) => file.startsWith('temp-'))).toEqual([]);
    });

    it.each([
        ['a name that is not that of a backup', '../cellar.db', 422, 'invalid_body'],
        ['a backup that is not there', 'cellar-backup-missing.zip', 404, 'not_found']
    ])('refuses %s, and changes nothing', async (_, name, status, code) => {
        const before = await countryNames();

        const response = await restore({ filename: name });

        expect(response.status).toBe(status);
        expect((await response.json()).error.code).toBe(code);
        expect(await countryNames()).toEqual(before);
    });
});
