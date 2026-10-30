import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scratchFolder } from '../../test/scratch';

/** Runs the check with DATABASE_PATH set, and returns whether it stopped the process. */
async function stopsWithDatabaseAt(databasePath: string): Promise<boolean> {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();
    const { exitUnlessDirsWritable } = await import('./writable-dirs');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitUnlessDirsWritable();
    return exit.mock.calls.length > 0;
}

describe('exitUnlessDirsWritable with the database outside DATA_DIR', () => {
    // A folder of its own for each test, next to the DATA_DIR that setup.ts puts in the scratch
    // folder; restored to writable so that the scratch folder can be removed.
    const folders: string[] = [];
    function outsideFolder(): string {
        const folder = scratchFolder('elsewhere-');
        folders.push(folder);
        return folder;
    }

    afterEach(() => {
        for (const folder of folders.splice(0)) chmodSync(folder, 0o755);
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('lets the app start when the folder and the file are writable', async () => {
        const folder = outsideFolder();
        writeFileSync(path.join(folder, 'cellar.db'), '');
        expect(await stopsWithDatabaseAt(path.join(folder, 'cellar.db'))).toBe(false);
    });

    it('creates a missing folder for the database, like the other folders', async () => {
        const missing = path.join(outsideFolder(), 'missing');
        expect(await stopsWithDatabaseAt(path.join(missing, 'cellar.db'))).toBe(false);
        expect(existsSync(missing)).toBe(true);
    });

    it('stops the app when the folder of the database is read-only', async () => {
        const folder = outsideFolder();
        chmodSync(folder, 0o555);
        expect(await stopsWithDatabaseAt(path.join(folder, 'cellar.db'))).toBe(true);
    });

    it('stops the app when the database file is read-only', async () => {
        const folder = outsideFolder();
        writeFileSync(path.join(folder, 'cellar.db'), '');
        chmodSync(path.join(folder, 'cellar.db'), 0o444);
        expect(await stopsWithDatabaseAt(path.join(folder, 'cellar.db'))).toBe(true);
    });
});
