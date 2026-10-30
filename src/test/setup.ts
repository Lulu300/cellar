import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { afterAll, vi } from 'vitest';

// Every test file gets its own data folders, through the variables that move them in production, so
// that no test reaches the developer's data/, static/uploads or csv-imports. Set before the app's
// modules load, which read them once. Vitest runs each test file in its own process.
const scratchDir = mkdtempSync(path.join(realpathSync(tmpdir()), 'cellar-test-'));
process.env.DATA_DIR = path.join(scratchDir, 'data');
process.env.DATABASE_PATH = path.join(scratchDir, 'data', 'cellar.db');
process.env.UPLOADS_DIR = path.join(scratchDir, 'uploads');
process.env.CSV_IMPORTS_DIR = path.join(scratchDir, 'csv-imports');
// Like the volumes of a container. The app creates them too, but only once it opens the database.
for (const dir of ['data', 'uploads/wines', 'csv-imports']) {
    mkdirSync(path.join(scratchDir, dir), { recursive: true });
}

afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
});

// The database of the tests starts with the schema of drizzle/. A test file can mock the module
// again to start from another schema.
vi.mock('#lib/server/db/index.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/db/index.js')>();
    module.migrateSchema(module.db);
    return module;
});

// Should code open a database file again by itself, a test must fail loudly instead of reading or
// writing the developer's data.
vi.mock('better-sqlite3', async (importOriginal) => {
    const { default: Database } = await importOriginal<{ default: typeof BetterSqlite3 }>();
    class ScratchOnly extends Database {
        constructor(filename?: string | Buffer, options?: BetterSqlite3.Options) {
            const name = String(filename);
            if (name !== ':memory:' && !path.resolve(name).startsWith(scratchDir + path.sep)) {
                throw new Error(`Test opened ${name}`);
            }
            super(filename, options);
        }
    }
    return { default: ScratchOnly };
});
