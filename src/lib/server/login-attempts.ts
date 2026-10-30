import { isIPv6 } from 'node:net';

// Access code attempts per client, kept in memory: the app runs as a single process, and a restart
// only gives an attacker a few more guesses.

// Short limit: never more than 5 attempts in any 60 seconds.
const MAX_IN_WINDOW = 5;
const WINDOW_MS = 60_000;
// Long limit, so that steady pacing under the short one gets nowhere either: every attempt adds 1
// to a level that drains by 1 every 15 minutes, and none is allowed while it would exceed 20. A
// burst of mistakes is fine; beyond it, a client gets 4 attempts an hour.
const MAX_LEVEL = 20;
const DRAIN_MS = 15 * 60_000;
// Bounds memory when many addresses try.
const MAX_CLIENTS = 10_000;

interface Attempts {
    /** Times of the attempts made in the last WINDOW_MS, oldest first. */
    recent: number[];
    level: number;
    updatedAt: number;
}

const attemptsByClient = new Map<string, Attempts>();

/** IPv6 hosts usually get a whole /64, so each address in it must not get its own allowance. */
function clientKey(address: string): string {
    const ip = address.split('%')[0];
    // IPv4 clients, including IPv4-mapped IPv6 ones such as ::ffff:192.168.1.20, keep their address.
    if (!isIPv6(ip) || ip.includes('.')) return ip;

    const [head, tail] = ip.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const zeros =
        tail === undefined ? [] : Array(8 - headGroups.length - tailGroups.length).fill('0');
    const groups = [...headGroups, ...zeros, ...tailGroups].slice(0, 4);
    return `${groups.map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
}

function isForgotten(attempts: Attempts, now: number): boolean {
    return now - attempts.updatedAt >= Math.max(WINDOW_MS, attempts.level * DRAIN_MS);
}

function track(key: string, now: number): Attempts {
    if (attemptsByClient.size >= MAX_CLIENTS) {
        for (const [otherKey, other] of attemptsByClient) {
            if (isForgotten(other, now)) attemptsByClient.delete(otherKey);
        }
    }
    if (attemptsByClient.size >= MAX_CLIENTS) {
        // Maps iterate in insertion order, so this drops the client tracked the longest.
        attemptsByClient.delete(attemptsByClient.keys().next().value!);
    }
    const attempts: Attempts = { recent: [], level: 0, updatedAt: now };
    attemptsByClient.set(key, attempts);
    return attempts;
}

/**
 * Counts an attempt before the code is checked, so that parallel requests cannot all get through
 * while the hash is computed. Returns 0 when the attempt may go ahead, otherwise the seconds the
 * client must wait; a refused attempt is not counted, and is refused even with the right code.
 */
export function registerAttempt(address: string): number {
    const key = clientKey(address);
    const now = Date.now();
    const attempts = attemptsByClient.get(key) ?? track(key, now);

    attempts.level = Math.max(0, attempts.level - (now - attempts.updatedAt) / DRAIN_MS);
    attempts.updatedAt = now;
    attempts.recent = attempts.recent.filter((time) => now - time < WINDOW_MS);

    const waitMs = Math.max(
        attempts.recent.length >= MAX_IN_WINDOW ? attempts.recent[0] + WINDOW_MS - now : 0,
        (attempts.level + 1 - MAX_LEVEL) * DRAIN_MS
    );
    if (waitMs > 0) return Math.ceil(waitMs / 1000);

    attempts.recent.push(now);
    attempts.level += 1;
    return 0;
}

/** After a right code: the client's earlier mistakes no longer count. */
export function clearAttempts(address: string): void {
    attemptsByClient.delete(clientKey(address));
}
