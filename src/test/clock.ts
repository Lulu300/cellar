import { vi } from 'vitest';

export const SECOND = 1000;
export const HOUR = 60 * 60 * SECOND;

/** Moves the clock faked with `vi.useFakeTimers({ toFake: ['Date'] })` forward. */
export function elapse(ms: number) {
    vi.setSystemTime(Date.now() + ms);
}
