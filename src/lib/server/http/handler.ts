import { fail, type ActionFailure, type RequestEvent } from '@sveltejs/kit';
import type { ApiErrorBody } from '#lib/shared/api-error.js';
import { refusedWriteError } from '#lib/server/db-errors.js';
import {
    BarcodePrefixTooLongError,
    BarcodeRangeError,
    Code128EncodingError
} from '#lib/shared/barcode.js';
import { ApiError, ConflictError } from './errors.js';

/**
 * The ApiError that `error` stands for, or undefined for an unexpected error. `method` tells what a
 * foreign key refused: a DELETE of a row still in use, or another write naming a missing row.
 */
export function apiErrorOf(error: unknown, method: string): ApiError | undefined {
    if (error instanceof ApiError) return error;
    // A sequence that ran out; a route where the client chose the number answers 422 itself.
    if (error instanceof BarcodeRangeError) {
        return new ConflictError('barcode_range', error.message);
    }
    // A prefix saved before prefixes were validated may hold characters that Code 128 lacks.
    if (error instanceof Code128EncodingError) {
        return new ConflictError('barcode_not_encodable', error.message);
    }
    // Or one longer than the 6 characters that the format of the codes leaves room for.
    if (error instanceof BarcodePrefixTooLongError) {
        return new ConflictError('barcode_prefix_too_long', error.message);
    }
    return refusedWriteError(error, method);
}

export function apiErrorResponse({ status, code, message, details, headers }: ApiError): Response {
    const body: ApiErrorBody = { error: { code, message, details } };
    return Response.json(body, { status, headers });
}

/**
 * The ApiError for an error thrown while handling `request`: its own status and code for a known
 * error, 500 for any other, which is logged with the request it failed.
 */
function apiErrorFor(error: unknown, request: Request): ApiError {
    const known = apiErrorOf(error, request.method);
    if (known) return known;
    console.error(`${request.method} ${new URL(request.url).pathname} failed:`, error);
    return new ApiError(500, 'internal_error', 'Internal server error');
}

/**
 * Wraps a route handler so that whatever it throws becomes an error answer of the API: the one
 * place where errors turn into statuses and codes.
 */
export function apiHandler<Event extends RequestEvent>(
    handler: (event: Event) => Response | Promise<Response>
): (event: Event) => Promise<Response> {
    return async (event) => {
        try {
            return await handler(event);
        } catch (error) {
            return apiErrorResponse(apiErrorFor(error, event.request));
        }
    };
}

/**
 * Wraps a form action as apiHandler wraps a route: whatever it throws becomes a failure that
 * carries the error body of the API, which the forms read as they read the API's answers.
 */
export function formAction<Event extends RequestEvent, Result>(
    action: (event: Event) => Result | Promise<Result>
): (event: Event) => Promise<Result | ActionFailure<ApiErrorBody>> {
    return async (event) => {
        try {
            return await action(event);
        } catch (error) {
            const { status, code, message, details } = apiErrorFor(error, event.request);
            return fail(status, { error: { code, message, details } });
        }
    };
}
