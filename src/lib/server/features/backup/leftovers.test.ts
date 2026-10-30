import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DATA_DIR, DATABASE_PATH } from '#lib/server/paths.js';
import { removeLeftoverFiles } from './leftovers';

const file = (name: string) => path.join(DATA_DIR, name);

describe('removeLeftoverFiles', () => {
    it('removes what a stop left of backups, restores and imports, and nothing else', () => {
        const leftovers = [
            'cellar-backup-stopped.zip.partial',
            'cellar-backup-stopped.zip.db.partial',
            'cellar-export-stopped.zip.partial',
            'cellar-backup-stopped.zip.db.partial-journal',
            // A restore: the uploaded zip, and the folder it was extracted to.
            'temp-restore-2026-10-23T10-00-00-000.zip',
            'temp-extract-2026-10-23T10-00-00-000/',
            // A JSON import, and an import of images.
            'temp-import-2026-10-23T10-00-00-000.zip',
            'temp-extract-import-2026-10-23T10-00-00-000/',
            'temp-zip-import-1792768000000.zip',
            'temp-zip-import-1792768000000/',
            // The zip of a download of images.
            'temp-images-0b7e3c52-4f1a-4c8e-9a51-2d6f0e8b9c11.zip'
        ].map(file);
        const others = [
            'notes.partial',
            'odd.partial/',
            'temp-notes.txt',
            'cellar-backup-x.zip'
        ].map(file);
        for (const name of [...leftovers, ...others]) {
            if (name.endsWith('/')) mkdirSync(path.join(name, 'images'), { recursive: true });
            else writeFileSync(name, 'content');
        }
        // The copy of a restored database, staged next to the live one, and its WAL files.
        const staged = ['', '-wal', '-shm'].map((suffix) => `${DATABASE_PATH}.restore${suffix}`);
        for (const name of staged) writeFileSync(name, 'staged database');

        expect(() => removeLeftoverFiles()).not.toThrow();

        expect([...leftovers, ...staged].filter((name) => existsSync(name))).toEqual([]);
        expect(others.filter((name) => !existsSync(name))).toEqual([]);
    });

    it('logs a file it cannot remove, and goes on', () => {
        writeFileSync(file('cellar-backup-locked.zip.partial'), 'the start of a zip');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        chmodSync(DATA_DIR, 0o555);
        try {
            expect(() => removeLeftoverFiles()).not.toThrow();
        } finally {
            chmodSync(DATA_DIR, 0o755);
        }

        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('cellar-backup-locked.zip.partial'),
            expect.objectContaining({ code: 'EACCES' })
        );
        error.mockRestore();
    });
});
