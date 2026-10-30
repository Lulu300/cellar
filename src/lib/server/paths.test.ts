import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageUrl, resolveInDir } from './paths';

const DIR = 'some/dir';

describe('resolveInDir', () => {
    it('resolves a plain file name directly inside the folder', () => {
        expect(resolveInDir(DIR, 'label.jpg')).toBe(path.resolve(DIR, 'label.jpg'));
    });

    it('accepts the names users give images: spaces, accents, apostrophes', () => {
        const name = "Château d'Yquem 2001.jpg";
        expect(resolveInDir(DIR, name)).toBe(path.resolve(DIR, name));
    });

    it.each([
        ['parent folder', '..'],
        ['current folder', '.'],
        ['hidden file', '.DS_Store'],
        ['traversal', '../cellar.db'],
        ['absolute POSIX path', '/etc/passwd'],
        ['absolute Windows path', 'C:\\Windows\\win.ini'],
        ['sub-folder', 'sub/label.jpg'],
        ['Windows sub-folder', 'sub\\label.jpg'],
        ['null byte', 'label.jpg\0.png'],
        ['newline', 'label\n.jpg'],
        ['other control character', 'label\x1b.jpg'],
        ['delete character', 'label\x7f.jpg'],
        ['empty name', '']
    ])('refuses a %s', (_, name) => {
        expect(resolveInDir(DIR, name)).toBeNull();
    });

    it.each([undefined, null, 42, ['label.jpg']])(
        'refuses a name that is not a string: %j',
        (name) => {
            expect(resolveInDir(DIR, name)).toBeNull();
        }
    );
});

describe('data paths', () => {
    const VARIABLES = ['DATA_DIR', 'DATABASE_PATH', 'UPLOADS_DIR', 'CSV_IMPORTS_DIR'];

    async function freshPaths(env: Record<string, string | undefined>) {
        for (const name of VARIABLES) vi.stubEnv(name, env[name]);
        vi.resetModules();
        const { DATA_DIR, DATABASE_PATH, IMAGES_DIR, CSV_IMPORTS_DIR } = await import('./paths');
        return { DATA_DIR, DATABASE_PATH, IMAGES_DIR, CSV_IMPORTS_DIR };
    }

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // Existing installs keep their data where it is: the Docker volumes mount these folders.
    it('default to the folders of the earlier versions', async () => {
        expect(await freshPaths({})).toEqual({
            DATA_DIR: './data',
            DATABASE_PATH: 'data/cellar.db',
            IMAGES_DIR: './static/uploads/wines',
            CSV_IMPORTS_DIR: './csv-imports'
        });
    });

    it('come from the environment', async () => {
        expect(
            await freshPaths({
                DATA_DIR: '/srv/cellar',
                DATABASE_PATH: '/var/lib/cellar.db',
                UPLOADS_DIR: '/srv/uploads',
                CSV_IMPORTS_DIR: '/srv/csv'
            })
        ).toEqual({
            DATA_DIR: '/srv/cellar',
            DATABASE_PATH: '/var/lib/cellar.db',
            IMAGES_DIR: '/srv/uploads/wines',
            CSV_IMPORTS_DIR: '/srv/csv'
        });
    });

    it('put the database in DATA_DIR unless DATABASE_PATH is set', async () => {
        expect((await freshPaths({ DATA_DIR: '/srv/cellar' })).DATABASE_PATH).toBe(
            '/srv/cellar/cellar.db'
        );
    });
});

describe('imageUrl', () => {
    it('encodes the file name, which may hold a space, an accent, `#` or `?`', () => {
        expect(imageUrl({ path: '/uploads/wines/', filename: 'Château #1?.jpg' })).toBe(
            '/uploads/wines/Ch%C3%A2teau%20%231%3F.jpg'
        );
    });
});
