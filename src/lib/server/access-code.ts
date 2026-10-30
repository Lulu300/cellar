import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';
import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appSettings } from '#lib/server/db/schema.js';
import type * as schema from '#lib/server/db/schema.js';

// The database is passed in rather than imported, because #lib/server/db runs
// hashPlaintextAccessCode at startup and would otherwise import itself through this module.
type Database = BetterSQLite3Database<typeof schema>;

export const ACCESS_CODE_KEY = 'access_code';
// Far above any real code; refusing longer ones bounds the work a request can cause.
export const MAX_ACCESS_CODE_LENGTH = 256;

// 32 MiB and a few tens of milliseconds per hash, affordable on a NAS since the attempt limit keeps
// checks rare. Someone holding a backup can still try every 4-digit code offline; the hash keeps a
// longer code, often reused elsewhere, out of reach. Stored hashes carry their own parameters, so
// raising these later keeps existing codes valid.
const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// scrypt$N=32768,r=8,p=1$<salt>$<hash>, salt and hash in base64.
const HASH_FORMAT = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+=*)\$([A-Za-z0-9+/]+=*)$/;
// Bounds for the parameters read from a stored hash, which could otherwise ask scrypt for
// gigabytes of memory or minutes of work. Raising SCRYPT_PARAMS past them means raising them too.
const MAX_SCRYPT_MEMORY = 64 * 1024 * 1024;
const MAX_P = 4;

// What OpenSSL allocates for scrypt, and checks against maxmem: 128·r·(N + p + 2) bytes.
function scryptMemory({ N, r, p }: typeof SCRYPT_PARAMS): number {
    return 128 * r * (N + p + 2);
}

const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    options: ScryptOptions
) => Promise<Buffer>;

function derive(code: string, salt: Buffer, keylen: number, params: typeof SCRYPT_PARAMS) {
    // Node's default limit, 32 MiB, is just short of what N=2^15, r=8 needs.
    return scryptAsync(code, salt, keylen, { ...params, maxmem: MAX_SCRYPT_MEMORY });
}

export async function hashAccessCode(code: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const hash = await derive(code, salt, KEY_BYTES, SCRYPT_PARAMS);
    const { N, r, p } = SCRYPT_PARAMS;
    return `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** The parts of a well-formed hash within bounds, or null. */
function parseHash(value: string) {
    const match = HASH_FORMAT.exec(value);
    if (!match) return null;

    const [N, r, p] = match.slice(1, 4).map(Number);
    const salt = Buffer.from(match[4], 'base64');
    const hash = Buffer.from(match[5], 'base64');
    const isValid =
        Number.isSafeInteger(N) &&
        N >= 2 &&
        (N & (N - 1)) === 0 &&
        r >= 1 &&
        p >= 1 &&
        p <= MAX_P &&
        scryptMemory({ N, r, p }) <= MAX_SCRYPT_MEMORY &&
        salt.length >= SALT_BYTES &&
        hash.length === KEY_BYTES;
    return isValid ? { params: { N, r, p }, salt, hash } : null;
}

/**
 * Whether a stored value was written as a hash, as opposed to a plaintext code from before 0.2.0.
 * Deliberately looser than parseHash: hashing a damaged hash as if it were a code would turn a
 * lock-out that a look at the database explains into one that nothing does.
 */
function isHashedAccessCode(value: string): boolean {
    return value.startsWith('scrypt$');
}

/** False, never an error, when the stored value is not a usable hash. */
export async function verifyAccessCode(code: string, storedHash: string): Promise<boolean> {
    const parsed = parseHash(storedHash);
    if (!parsed) return false;

    try {
        const actual = await derive(code, parsed.salt, KEY_BYTES, parsed.params);
        return timingSafeEqual(actual, parsed.hash);
    } catch (error) {
        console.error('Could not check the access code against the stored hash:', error);
        return false;
    }
}

export async function getStoredAccessCode(db: Database): Promise<string | undefined> {
    const [setting] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, ACCESS_CODE_KEY));
    return setting?.value;
}

// secure_delete only zeroes what is deleted from now on: the codes an earlier version replaced or
// deleted can still sit in free pages, which VACUUM rewrites away. In WAL mode, the change and the
// VACUUM only reach the -wal file: the old pages, plaintext code included, stay in the database
// file until a checkpoint, which would otherwise wait for the next clean close. Not worth failing
// the startup migrations or a restore for: the code itself is already hashed or gone.
function removeLeftoverPlaintext(db: Database) {
    try {
        db.run(sql`VACUUM`);
        // A connection still reading, such as the sqlite3 shell, stops the checkpoint halfway.
        const { busy } = db.get<{ busy: number }>(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
        if (busy) throw new Error('another connection blocked the checkpoint');
    } catch (error) {
        console.error('Earlier access codes may remain in the database file or its WAL:', error);
    }
}

/**
 * Before 0.2.0 the access code was stored in clear, starting as 1234 on every install. A chosen
 * code is hashed in place, so its owner still logs in with it. The default one is dropped instead:
 * a new one is then chosen with the setup token, as on a fresh install. Runs first at
 * startup, so that a later migration failure cannot leave a plaintext code that no login matches.
 */
export async function hashPlaintextAccessCode(db: Database): Promise<void> {
    const storedCode = await getStoredAccessCode(db);
    if (storedCode === undefined || isHashedAccessCode(storedCode)) return;

    if (storedCode === '1234') {
        await db.delete(appSettings).where(eq(appSettings.key, ACCESS_CODE_KEY));
        console.log('🔐 Removed the default access code: choose a new one with the setup token');
    } else {
        await db
            .update(appSettings)
            .set({ value: await hashAccessCode(storedCode), updatedAt: new Date() })
            .where(eq(appSettings.key, ACCESS_CODE_KEY));
        console.log('🔐 Hashed the access code stored in clear');
    }
    removeLeftoverPlaintext(db);
}

/**
 * A restore replaces the whole database, but the access code belongs to the instance, not to the
 * data, and the admin restoring just proved they know the current one. Putting it back means a
 * backup can never bring back 1234, a plaintext code, or no code at all for anyone to claim.
 */
export async function putBackAccessCode(db: Database, hash: string | undefined): Promise<void> {
    const restoredCode = await getStoredAccessCode(db);
    if (restoredCode === hash) return;

    if (hash === undefined) {
        await db.delete(appSettings).where(eq(appSettings.key, ACCESS_CODE_KEY));
    } else {
        await db
            .insert(appSettings)
            .values({ key: ACCESS_CODE_KEY, value: hash })
            .onConflictDoUpdate({
                target: appSettings.key,
                set: { value: hash, updatedAt: new Date() }
            });
    }
    if (restoredCode !== undefined && !isHashedAccessCode(restoredCode))
        removeLeftoverPlaintext(db);
}
