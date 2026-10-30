import { scrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateSchema, openDatabase } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { appSettings } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { DATA_DIR } from '#lib/server/paths.js';
import {
    ACCESS_CODE_KEY,
    getStoredAccessCode,
    hashAccessCode,
    hashPlaintextAccessCode,
    putBackAccessCode,
    verifyAccessCode
} from './access-code';

// Wrapped, to tell a hash refused on sight from one that scrypt then failed on.
vi.mock('node:crypto', async (importOriginal) => {
    const crypto = await importOriginal<typeof import('node:crypto')>();
    return { ...crypto, scrypt: vi.fn(crypto.scrypt) };
});

const storeAccessCode = (value: string) => setAppSetting(ACCESS_CODE_KEY, value);
const timestamps = () => ({ createdAt: new Date(), updatedAt: new Date() });

describe('hashAccessCode and verifyAccessCode', () => {
    let hash: string;

    beforeAll(async () => {
        hash = await hashAccessCode('cave-2026');
    });

    it('stores a salted scrypt hash that carries its parameters', async () => {
        expect(hash).toMatch(/^scrypt\$N=32768,r=8,p=1\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/);
        expect(hash).not.toContain('cave-2026');
        expect(await hashAccessCode('cave-2026')).not.toBe(hash);
    });

    it('accepts the right code only', async () => {
        expect(await verifyAccessCode('cave-2026', hash)).toBe(true);
        expect(await verifyAccessCode('cave-2027', hash)).toBe(false);
        expect(await verifyAccessCode('', hash)).toBe(false);
    });

    describe('rejects, before any hashing, a stored value that is not a usable hash', () => {
        // Parts of the valid hash: 2 is the salt, 3 the key.
        const part = (index: number) => hash.split('$')[index];
        const variants: [string, () => string][] = [
            ['empty', () => ''],
            ['a plaintext code', () => 'cave-2026'],
            ['a damaged hash', () => 'scrypt$broken'],
            ['N not a power of two', () => hash.replace('N=32768', 'N=30000')],
            ['N needing 1 GiB of memory', () => hash.replace('N=32768', 'N=1048576')],
            ['r of zero', () => hash.replace('r=8', 'r=0')],
            ['p above 4', () => hash.replace('p=1', 'p=5')],
            [
                'a short salt',
                () => `scrypt$N=32768,r=8,p=1$${Buffer.alloc(8).toString('base64')}$${part(3)}`
            ],
            [
                'a short hash',
                () => `scrypt$N=32768,r=8,p=1$${part(2)}$${Buffer.alloc(16).toString('base64')}`
            ],
            [
                'characters outside base64',
                () => `scrypt$N=32768,r=8,p=1$${part(2)}$${part(3).replace(/^./, '!')}`
            ]
        ];

        it.each(variants)('%s', async (_, storedValue) => {
            const value = storedValue();
            vi.mocked(scrypt).mockClear();

            await expect(verifyAccessCode('cave-2026', value)).resolves.toBe(false);
            expect(scrypt).not.toHaveBeenCalled();
        });
    });
});

describe('hashPlaintextAccessCode', () => {
    beforeEach(async () => {
        await db.delete(appSettings);
    });

    it('hashes a code stored in clear, which still logs in', async () => {
        await storeAccessCode('cave-2026');

        await hashPlaintextAccessCode(db);

        const stored = await getStoredAccessCode(db);
        expect(stored).toMatch(/^scrypt\$/);
        expect(await verifyAccessCode('cave-2026', stored!)).toBe(true);
    });

    it('removes the default code 1234, to have a new one chosen', async () => {
        await storeAccessCode('1234');

        await hashPlaintextAccessCode(db);

        expect(await getStoredAccessCode(db)).toBeUndefined();
    });

    it.each([
        ['a hash', 'scrypt$N=32768,r=8,p=1$c2FsdA==$aGFzaA=='],
        ['a damaged hash, left for a person to inspect', 'scrypt$broken']
    ])('leaves %s alone', async (_, value) => {
        await storeAccessCode(value);

        await hashPlaintextAccessCode(db);

        expect(await getStoredAccessCode(db)).toBe(value);
    });

    it('does nothing without a code', async () => {
        await hashPlaintextAccessCode(db);

        expect(await getStoredAccessCode(db)).toBeUndefined();
    });

    it.each([
        ['a code stored in clear', 'cave-4821'],
        ['the default code', '1234']
    ])('removes %s from the database file and its WAL', async (_, code) => {
        const file = plaintextDatabaseFile(code);
        const database = openDatabase(file);
        try {
            // As the startup does before hashing: this copies the page holding the code into the
            // -wal file, which a checkpoint that does not truncate it would leave there.
            database
                .insert(appSettings)
                .values({ id: 'version', key: 'app_version', value: '0.7.0', ...timestamps() })
                .run();

            await hashPlaintextAccessCode(database);

            for (const written of [file, `${file}-wal`]) {
                expect(readFileSync(written).includes(ACCESS_CODE_KEY + code)).toBe(false);
            }
        } finally {
            database.$client.close();
        }
    });

    it('says so when another connection keeps the plaintext in the database file', async () => {
        const file = plaintextDatabaseFile('cave-7302');
        const reader = openDatabase(file).$client;
        reader.exec('BEGIN');
        reader.prepare('SELECT 1 FROM app_settings').get();
        const database = openDatabase(file);
        // Gives up at once instead of after 5 seconds.
        database.$client.pragma('busy_timeout = 0');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await hashPlaintextAccessCode(database);

            expect(
                await verifyAccessCode('cave-7302', (await getStoredAccessCode(database))!)
            ).toBe(true);
            expect(consoleError).toHaveBeenCalledWith(
                'Earlier access codes may remain in the database file or its WAL:',
                expect.objectContaining({ message: 'another connection blocked the checkpoint' })
            );
        } finally {
            consoleError.mockRestore();
            reader.close();
            database.$client.close();
        }
    });
});

/**
 * A database file holding `code` in clear, as a version before 0.2.0 left it: in the file itself,
 * whereas the hash and the VACUUM of a WAL connection first go to the -wal file.
 */
function plaintextDatabaseFile(code: string): string {
    const file = path.join(DATA_DIR, `plaintext-${code}.db`);
    const database = openDatabase(file);
    migrateSchema(database);
    database
        .insert(appSettings)
        .values({
            id: 'code',
            key: ACCESS_CODE_KEY,
            value: code,
            ...timestamps()
        })
        .run();
    // Closing moves the row from the -wal file into the database file.
    database.$client.close();
    expect(readFileSync(file).includes(ACCESS_CODE_KEY + code)).toBe(true);
    return file;
}

describe('putBackAccessCode', () => {
    const INSTANCE_HASH = 'scrypt$N=32768,r=8,p=1$aW5zdGFuY2U=$aGFzaA==';

    beforeEach(async () => {
        await db.delete(appSettings);
    });

    it.each([
        ['the default code', '1234'],
        ['a plaintext code', 'old-code'],
        ['another hash', 'scrypt$N=32768,r=8,p=1$YmFja3Vw$aGFzaA==']
    ])('replaces %s brought back by a backup with the instance code', async (_, restored) => {
        await storeAccessCode(restored);

        await putBackAccessCode(db, INSTANCE_HASH);

        expect(await getStoredAccessCode(db)).toBe(INSTANCE_HASH);
    });

    it('puts the instance code into a backup that has none', async () => {
        await putBackAccessCode(db, INSTANCE_HASH);

        expect(await getStoredAccessCode(db)).toBe(INSTANCE_HASH);
    });

    it('removes the code of a backup when the instance had none', async () => {
        await storeAccessCode('1234');

        await putBackAccessCode(db, undefined);

        expect(await getStoredAccessCode(db)).toBeUndefined();
    });
});
