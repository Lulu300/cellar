import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elapse, HOUR, SECOND } from '../../test/clock';
import { newClient } from '../../test/event';
import { clearAttempts, registerAttempt } from './login-attempts';

/** Makes `count` attempts at once and returns the wait of each, 0 meaning allowed. */
function attempt(client: string, count: number): number[] {
    return Array.from({ length: count }, () => registerAttempt(client));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('registerAttempt', () => {
    it('allows 5 attempts a minute, then asks to wait for the oldest to leave the window', () => {
        const client = newClient();

        expect(attempt(client, 5)).toEqual([0, 0, 0, 0, 0]);
        expect(registerAttempt(client)).toBe(60);
        elapse(59 * SECOND);
        expect(registerAttempt(client)).toBe(1);
        elapse(1 * SECOND);
        expect(registerAttempt(client)).toBe(0);
    });

    it('does not count refused attempts, so retrying does not push the wait back', () => {
        const client = newClient();
        attempt(client, 5);
        elapse(30 * SECOND);

        expect(attempt(client, 5)).toEqual([30, 30, 30, 30, 30]);
        elapse(30 * SECOND);
        expect(registerAttempt(client)).toBe(0);
    });

    // A counter reset every minute would allow 4 at the end of one minute and 5 more at the start
    // of the next; the sliding window never allows more than 5 in any 60 seconds.
    it('allows no second burst at the edge of the window', () => {
        const client = newClient();
        attempt(client, 1);
        elapse(59 * SECOND);
        expect(attempt(client, 4)).toEqual([0, 0, 0, 0]);

        elapse(1 * SECOND);
        expect(registerAttempt(client)).toBe(0);
        expect(registerAttempt(client)).toBe(59);
    });

    it('allows about 4 attempts an hour after the first 20, at any pace', () => {
        const client = newClient();
        let allowed = 0;
        // Every 12 seconds: the fastest pace the per-minute limit lets through.
        for (let elapsed = 0; elapsed < 24 * HOUR; elapsed += 12 * SECOND) {
            if (registerAttempt(client) === 0) allowed++;
            elapse(12 * SECOND);
        }

        expect(allowed).toBeLessThanOrEqual(20 + 24 * 4);
        expect(allowed).toBeGreaterThanOrEqual(24 * 4);
    });

    it('forgets the mistakes of a client that then gives the right code', () => {
        const client = newClient();
        attempt(client, 5);

        clearAttempts(client);

        expect(registerAttempt(client)).toBe(0);
    });

    it('gives each IPv4 address its own allowance', () => {
        const client = newClient();
        attempt(client, 5);

        expect(registerAttempt(newClient())).toBe(0);
        expect(registerAttempt(`::ffff:${newClient()}`)).toBe(0);
    });

    it('gives one allowance to a whole IPv6 /64', () => {
        attempt('2001:db8:0:1::1', 5);

        expect(registerAttempt('2001:db8:0:1:ffff:ffff:ffff:ffff')).toBeGreaterThan(0);
        expect(registerAttempt('2001:0db8:0000:0001::2%eth0')).toBeGreaterThan(0);
        expect(registerAttempt('2001:db8:0:2::1')).toBe(0);
    });
});
