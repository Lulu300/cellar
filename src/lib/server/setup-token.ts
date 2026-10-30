import { randomBytes, timingSafeEqual } from 'node:crypto';

// While no access code is set, choosing one also takes this token, which only the server logs
// show: someone else on the network cannot claim the instance before its owner. It lives in
// memory only, so a restart makes a new one.

// Digits and capitals without 0/O and 1/I: 32 characters, so each byte maps evenly to one.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
// Any visitor can open the first-code dialog, so repeats are spaced to keep the logs bounded.
const REPEAT_INTERVAL_MS = 60_000;
// Room for any spacing around the 14 characters, while bounding the work of normalising.
export const MAX_SETUP_TOKEN_LENGTH = 64;

/** As logged: three groups of four, such as 7KQ4-MZ2X-H9TD. */
let token: string | undefined;
let announcedAt = 0;

function randomGroup(): string {
    return Array.from(randomBytes(4), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/** Upper case without spaces or dashes, so that the token can be typed the way it reads best. */
function normalize(value: string): string {
    return value.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Logs the token, creating it first if needed. Called when the server finds no code, and again
 * when the first-code dialog opens, so that the token stays near the end of the logs.
 */
export function announceSetupToken(): void {
    if (token !== undefined && Date.now() - announcedAt < REPEAT_INTERVAL_MS) return;
    token ??= [randomGroup(), randomGroup(), randomGroup()].join('-');
    announcedAt = Date.now();
    console.log(
        `🔑 Setup token to choose the first access code: ${token} (see "Access code" in README-Docker.md)`
    );
}

export function isSetupToken(candidate: string): boolean {
    if (token === undefined) return false;
    const expected = Buffer.from(normalize(token));
    const actual = Buffer.from(normalize(candidate));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Once the first code is set, the token must stop working. */
export function revokeSetupToken(): void {
    token = undefined;
}
