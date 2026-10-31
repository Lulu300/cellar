import { ApiError } from '#lib/server/http/errors.js';
import { apiErrorResponse } from '#lib/server/http/handler.js';

// A restore, a JSON import or a wipe saves the current data, then replaces it: a write that lands in
// between would be in neither, and lost without anyone knowing. So while one runs, other writes are
// refused with a 503 that the client sees, and it waits for the writes already under way.

let held = false;
let writesUnderWay = 0;
let onIdle: (() => void) | null = null;

/** The 503 of a write refused while a restore, an import or a wipe holds the writes. */
function writesHeldError(): ApiError {
    return new ApiError(
        503,
        'writes_held',
        'A restore, an import or a wipe is in progress. Try again in a moment.',
        undefined,
        { 'Retry-After': '10' }
    );
}

/**
 * Runs `write`, unless a restore, an import or a wipe holds the writes: then throws the 503
 * `writes_held`. A hold waits for it to end.
 */
export async function runAsWrite<T>(write: () => T | Promise<T>): Promise<T> {
    if (held) throw writesHeldError();
    writesUnderWay += 1;
    try {
        return await write();
    } finally {
        writesUnderWay -= 1;
        if (writesUnderWay === 0) onIdle?.();
    }
}

/** Runs the handling of a request that may write, or answers the 503 while the writes are held. */
export async function runWrite(handle: () => Promise<Response>): Promise<Response> {
    return held ? apiErrorResponse(writesHeldError()) : runAsWrite(handle);
}

/**
 * Runs `task` once the writes under way have ended, refusing new ones until it ends. Throws the
 * 503 `writes_held` when another task holds them already.
 */
export async function holdWrites<T>(task: () => Promise<T>): Promise<T> {
    if (held) throw writesHeldError();
    held = true;
    try {
        if (writesUnderWay > 0) {
            await new Promise<void>((resolve) => (onIdle = resolve));
            onIdle = null;
        }
        return await task();
    } finally {
        held = false;
    }
}
