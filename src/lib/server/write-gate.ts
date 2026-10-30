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

/** Runs the handling of a request that may write, unless a restore, an import or a wipe holds them. */
export async function runWrite(handle: () => Promise<Response>): Promise<Response> {
    if (held) return apiErrorResponse(writesHeldError());
    writesUnderWay += 1;
    try {
        return await handle();
    } finally {
        writesUnderWay -= 1;
        if (writesUnderWay === 0) onIdle?.();
    }
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
