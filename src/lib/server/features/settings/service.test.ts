import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, sessions } from '#lib/server/db/schema.js';
import { ACCESS_CODE_KEY, getStoredAccessCode, hashAccessCode } from '#lib/server/access-code.js';
import { createSession } from '#lib/server/session.js';
import { announceSetupToken } from '#lib/server/setup-token.js';
import { fakeCookies, newClient } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { setAppSetting } from './repository';
import { changeAccessCode, getSettings, logIn, saveSettings, setFirstAccessCode } from './service';

const url = new URL('http://localhost');
const client = () => ({ address: newClient(), cookies: fakeCookies(), url });

beforeEach(() => {
    db.delete(appSettings).run();
    db.delete(sessions).run();
});

describe('settings', () => {
    it('saves the session timeout', () => {
        saveSettings({ sessionTimeoutHours: 48 });

        expect(getSettings()).toEqual({ sessionTimeoutHours: 48 });
    });
});

describe('setFirstAccessCode', () => {
    /** The setup token that the server logs, read from the log. */
    function setupToken(): string {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        announceSetupToken();
        const token = /: ([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/.exec(
            String(log.mock.calls.at(-1)?.[0])
        )?.[1];
        log.mockRestore();
        return token ?? 'no token logged';
    }

    it('stores the code and starts the only session', async () => {
        const earlier = createSession(fakeCookies(), url);
        const newcomer = client();

        await setFirstAccessCode('4321', setupToken(), newcomer);

        expect(await getStoredAccessCode(db)).toMatch(/^scrypt\$/);
        expect(newcomer.cookies.get('cellar_session')).toBeDefined();
        const left = db.select().from(sessions).all();
        expect(left).toHaveLength(1);
        expect(left[0].tokenHash).not.toBe(earlier.tokenHash);
    });

    it('stores neither the code nor the session when one of them fails', async () => {
        failWrites('INSERT', 'sessions', '1');

        await expect(setFirstAccessCode('4321', setupToken(), client())).rejects.toThrow();
        expect(await getStoredAccessCode(db)).toBeUndefined();
    });

    it('refuses a wrong setup token with 403', async () => {
        setupToken();
        await expect(setFirstAccessCode('4321', 'WRONG', client())).rejects.toMatchObject({
            status: 403,
            code: 'wrong_setup_token'
        });
    });
});

describe('changeAccessCode', () => {
    beforeEach(async () => {
        setAppSetting(ACCESS_CODE_KEY, await hashAccessCode('1111'));
    });

    it('replaces the code and ends every other session', async () => {
        const mine = createSession(fakeCookies(), url);
        createSession(fakeCookies(), url);

        await changeAccessCode('1111', '2222', newClient(), mine);

        expect(await logIn('2222', client())).toBe(true);
        expect(
            db
                .select()
                .from(sessions)
                .all()
                .map((row) => row.tokenHash)
        ).toContain(mine.tokenHash);
    });

    it('keeps the old code and the sessions when ending them fails', async () => {
        const mine = createSession(fakeCookies(), url);
        const other = createSession(fakeCookies(), url);
        failWrites('DELETE', 'sessions', '1');

        await expect(changeAccessCode('1111', '2222', newClient(), mine)).rejects.toThrow();
        expect(await logIn('1111', client())).toBe(true);
        expect(
            db
                .select()
                .from(sessions)
                .all()
                .map((row) => row.tokenHash)
        ).toContain(other.tokenHash);
    });

    it('refuses a wrong current code with 403', async () => {
        const mine = createSession(fakeCookies(), url);

        await expect(changeAccessCode('9999', '2222', newClient(), mine)).rejects.toMatchObject({
            status: 403,
            code: 'wrong_access_code'
        });
    });
});
