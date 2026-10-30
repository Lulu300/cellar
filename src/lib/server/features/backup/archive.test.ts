import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR, DATABASE_PATH, IMAGES_DIR } from '#lib/server/paths.js';
import { extractZip } from '#lib/server/zip.js';
import { createBackupZip, writeZipWithImages } from './archive';

// Wrapped so that a test can slow down the opening of the zip file.
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return { ...actual, createWriteStream: vi.fn(actual.createWriteStream) };
});

const partialFiles = () => readdirSync(DATA_DIR).filter((name) => name.endsWith('.partial'));

/** An image the app cannot read: the archive fails on it. Returns a function that undoes it. */
function lockedImage(): () => void {
    const locked = path.join(IMAGES_DIR, 'locked.jpg');
    writeFileSync(locked, 'label bytes');
    chmodSync(locked, 0o000);
    return () => chmodSync(locked, 0o644);
}

describe('createBackupZip', () => {
    let unlock = () => {};
    afterEach(() => unlock());

    it('removes its partial zip when the archive fails after the file was created', async () => {
        unlock = lockedImage();
        const zipPath = path.join(DATA_DIR, 'cellar-backup-unreadable-image.zip');

        await expect(createBackupZip(zipPath)).rejects.toThrow(/EACCES/);

        expect(existsSync(zipPath)).toBe(false);
        expect(partialFiles()).toEqual([]);
    });

    it('leaves no zip when the archive fails before the file is opened', async () => {
        unlock = lockedImage();
        // The file opens only after the archive has failed; Node still creates it then.
        vi.mocked(fs.createWriteStream).mockImplementationOnce((file, options) =>
            vi.mocked(fs.createWriteStream).getMockImplementation()!(file, {
                ...(typeof options === 'object' ? options : {}),
                fs: {
                    open: (...args: Parameters<typeof fs.open>) =>
                        setTimeout(() => fs.open(...args), 200),
                    write: fs.write,
                    writev: fs.writev,
                    close: fs.close
                }
            })
        );
        const zipPath = path.join(DATA_DIR, 'cellar-backup-early-failure.zip');

        await expect(createBackupZip(zipPath)).rejects.toThrow(/EACCES/);

        // Past the delayed open, which creates the file if nothing removes it afterwards.
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(existsSync(zipPath)).toBe(false);
        expect(partialFiles()).toEqual([]);
    });

    it('rejects, instead of crashing the process, when the zip cannot be written', async () => {
        const zipPath = path.join(DATA_DIR, 'missing-folder', 'cellar-backup.zip');
        await expect(writeZipWithImages(zipPath, () => {})).rejects.toThrow(/ENOENT/);
    });
});

describe('writeZipWithImages', () => {
    it('writes under a temporary name, and gives the backup its name once complete', async () => {
        const zipPath = path.join(DATA_DIR, 'cellar-backup-slow.zip');
        const content = new PassThrough();

        const writing = writeZipWithImages(zipPath, (archive) => {
            archive.append(content, { name: 'cellar.db' });
        });
        content.write('the first half');
        await new Promise((resolve) => setTimeout(resolve, 50));

        // As `docker stop` would find it: nothing under the backup's name.
        expect(existsSync(zipPath)).toBe(false);
        expect(partialFiles()).toEqual(['cellar-backup-slow.zip.partial']);

        content.end(' and the second half');
        await writing;
        expect(existsSync(zipPath)).toBe(true);
        expect(partialFiles()).toEqual([]);
    });

    it('archives only the regular, visible files of the images folder', async () => {
        for (const name of readdirSync(IMAGES_DIR))
            rmSync(path.join(IMAGES_DIR, name), { force: true, recursive: true });
        writeFileSync(path.join(IMAGES_DIR, 'label.jpg'), 'label bytes');
        writeFileSync(path.join(IMAGES_DIR, '.DS_Store'), 'Finder data');
        mkdirSync(path.join(IMAGES_DIR, '@eaDir'));
        writeFileSync(path.join(IMAGES_DIR, '@eaDir', 'label.jpg'), 'NAS thumbnail');
        const zipPath = path.join(DATA_DIR, 'cellar-backup-images.zip');

        await createBackupZip(zipPath);

        const extracted = await extractZip(
            zipPath,
            path.join(DATA_DIR, 'images-backup'),
            () => true
        );
        expect(extracted.sort()).toEqual(['cellar.db', 'images/label.jpg']);
    });
});

describe('createBackupZip while another program writes', () => {
    it('always holds a sound database', async () => {
        const now = new Date();
        await db
            .insert(countries)
            .values({ id: 'fr', name: 'France', createdAt: now, updatedAt: now });
        // Another process, so that its writes run while the backup reads, with large rows so that
        // SQLite's automatic checkpoint runs often.
        const writer = spawn(
            process.execPath,
            [
                '-e',
                `const db = new (require('better-sqlite3'))(process.argv[1]);
                db.pragma('busy_timeout = 5000');
                const insert = db.prepare("INSERT INTO countries (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)");
                process.stdout.write('ready');
                for (let n = 0; ; n++) insert.run('c' + n, 'Country ' + n + ' '.repeat(2000));`,
                DATABASE_PATH
            ],
            { stdio: ['ignore', 'pipe', 'inherit'] }
        );
        try {
            await new Promise((resolve) => writer.stdout.once('data', resolve));
            let previousCount = 0;
            for (let index = 0; index < 5; index++) {
                const zipPath = path.join(DATA_DIR, `cellar-backup-busy-${index}.zip`);
                await createBackupZip(zipPath);

                const extractDir = path.join(DATA_DIR, `busy-${index}`);
                await extractZip(zipPath, extractDir, (name) => name === 'cellar.db');
                const { $client: copy } = openDatabase(path.join(extractDir, 'cellar.db'));
                expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
                const count = copy
                    .prepare('SELECT count(*) FROM countries')
                    .pluck()
                    .get() as number;
                copy.close();
                // Each backup holds the writes committed before it, while they keep coming.
                expect(count).toBeGreaterThan(previousCount);
                previousCount = count;
            }
        } finally {
            writer.kill();
        }
    }, 20_000);
});
