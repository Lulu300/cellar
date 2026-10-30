import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { migrateSchema } from '#lib/server/db/index.js';
import { openDatabase, type Db } from '#lib/server/db/connection.js';
import type { Session } from '#lib/server/db/schema.js';
import { createSession } from '#lib/server/session.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { POST } from '../routes/api/admin/restore/+server';
import { fakeCookies, fakeEvent } from './event';
import { buildZip, type ZipEntry } from './zip';

let backups = 0;

/**
 * A backup zip whose cellar.db has the schema of `migrationsFolder` (today's by default), then
 * whatever `fill` writes into it, followed by `extraEntries`, such as images.
 */
export function backupZip(
    fill: (database: Db) => void,
    {
        migrationsFolder,
        extraEntries = []
    }: { migrationsFolder?: string; extraEntries?: ZipEntry[] } = {}
): File {
    backups += 1;
    const dbPath = path.join(DATA_DIR, `backup-${backups}.db`);
    const database = openDatabase(dbPath);
    migrateSchema(database, migrationsFolder);
    fill(database);
    database.$client.close();
    const zip = buildZip([{ name: 'cellar.db', data: readFileSync(dbPath) }, ...extraEntries]);
    // So that the tests that list DATA_DIR see only what the restore leaves there.
    rmSync(dbPath);
    return new File([new Uint8Array(zip)], `cellar-backup-${backups}.zip`, {
        type: 'application/zip'
    });
}

/**
 * Restores as a logged-in admin would, as `session` when given: `body` is a zip sent as is, or
 * the name of a backup of the list.
 */
export async function restore(
    body: File | { filename: string },
    session?: Session
): Promise<Response> {
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/restore',
            routeId: '/api/admin/restore',
            body,
            session: session ?? (await createSession(fakeCookies(), new URL('http://localhost')))
        })
    );
}
