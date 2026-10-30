import { rmSync } from 'node:fs';
import { afterAll, expect, it, vi } from 'vitest';
import { db, migrateSchema } from '#lib/server/db/index.js';
import { sessions } from '#lib/server/db/schema.js';
import { fakeCookies } from '../../test/event';
import { createSession, getSession, keepOnlySession } from './session';

// The database of a backup made before the sessions table existed.
const { migrationsFolder } = vi.hoisted(() => ({ migrationsFolder: { path: '' } }));
vi.mock('#lib/server/db/index.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/db/index.js')>();
    const { migrationsBefore } = await import('../../test/database');
    migrationsFolder.path = migrationsBefore('0003_modern_caretaker');
    module.migrateSchema(module.db, migrationsFolder.path);
    return module;
});

afterAll(() => {
    rmSync(migrationsFolder.path, { recursive: true, force: true });
});

// A restore migrates the backup (replaceDatabaseFile), then runs keepOnlySession on it.
it('works again on a restored backup made before the sessions table existed', async () => {
    const cookies = fakeCookies();
    cookies.set('cellar_session', 'token from before the restore', { path: '/' });
    await expect(getSession(cookies)).rejects.toThrow(/no such table: sessions/);

    migrateSchema(db);
    // The session of the admin restoring lives in the replaced database, not in the backup.
    const session = await createSession(cookies, new URL('http://localhost'));
    await db.delete(sessions);
    keepOnlySession(session);

    expect(await getSession(cookies)).toMatchObject({ tokenHash: session.tokenHash });
});
