import { readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { POST } from './+server';

function exportCsv(tables: string[], customName?: unknown) {
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/export-csv',
            routeId: '/api/admin/export-csv',
            body: { tables, customName }
        })
    );
}

describe('POST /api/admin/export-csv', () => {
    beforeAll(async () => {
        const now = new Date();
        await db
            .insert(countries)
            .values({ id: 'fr', name: 'France', createdAt: now, updatedAt: now });
    });

    it('answers each file, named after the custom name, and writes none on the server', async () => {
        const dataFiles = readdirSync(DATA_DIR);

        const response = await exportCsv(['countries', 'origins'], '  Cœur de cave € 🍷 ');

        expect(response.status).toBe(200);
        const { files, totalRecords } = await response.json();
        // origins is empty: it gives no file.
        expect(files).toEqual([
            {
                filename: expect.stringMatching(
                    /^cellar-export-Cœur de cave € 🍷-countries-.+\.csv$/
                ),
                csv: 'name\nFrance',
                recordCount: 1
            }
        ]);
        expect(totalRecords).toBe(1);
        expect(readdirSync(DATA_DIR)).toEqual(dataFiles);
    });

    it.each([
        ['is not a string', { name: 'cellar' }, 'invalid_body'],
        ['holds a separator', 'a/b', 'invalid_file_name'],
        // 152 bytes in UTF-8, 76 characters.
        ['is longer than 150 bytes', 'é'.repeat(76), 'invalid_file_name'],
        ['is longer still', 'é'.repeat(200), 'invalid_file_name']
    ])('refuses a custom name that %s', async (_, customName, code) => {
        // origins is empty: the name is checked before any table is read
        const response = await exportCsv(['origins'], customName);

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe(code);
    });

    it('refuses a table that is not one of the exported ones', async () => {
        const response = await exportCsv(['__proto__']);

        expect(response.status).toBe(422);
    });
});
