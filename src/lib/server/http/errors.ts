import type { ApiErrorCode } from '#lib/shared/api-error.js';

/**
 * An error that the API answers with its status and `{ error: { code, message, details } }`.
 * The services throw one of the domain errors below, each of which sets its own status, rather
 * than an ApiError with a status of their choice: the statuses are all decided in this file.
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: ApiErrorCode,
        message: string,
        readonly details?: unknown,
        readonly headers?: Record<string, string>
    ) {
        super(message);
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string, details?: unknown) {
        super(404, 'not_found', message, details);
    }
}

/** The route has no handler for the method of the request; `allow` lists those it has. */
export class MethodNotAllowedError extends ApiError {
    constructor(method: string, allow: string | null) {
        super(
            405,
            'method_not_allowed',
            `This route does not answer ${method}`,
            undefined,
            allow ? { Allow: allow } : undefined
        );
    }
}

/** The request is valid, but the data as it stands refuses it. */
export class ConflictError extends ApiError {
    constructor(code: ApiErrorCode, message: string, details?: unknown) {
        super(409, code, message, details);
    }
}

/** The request breaks a rule: a field of its body, or a value it asks for. */
export class ValidationError extends ApiError {
    constructor(code: ApiErrorCode, message: string, details?: unknown) {
        super(422, code, message, details);
    }
}

/**
 * The 422 invalid_body for one field that breaks a rule outside the schema of the route, such as a
 * missing file: `details` lists its issue as the schema's issues are listed.
 */
export function invalidField(path: string, message: string): ValidationError {
    return new ValidationError('invalid_body', message, [{ path, message }]);
}

/** A secret of the request, the access code or the setup token, is wrong. */
export class ForbiddenError extends ApiError {
    constructor(code: ApiErrorCode, message: string) {
        super(403, code, message);
    }
}

/** The client tried a secret too often; it may try again after `retryAfter` seconds. */
export class TooManyAttemptsError extends ApiError {
    constructor(retryAfter: number) {
        super(
            429,
            'too_many_attempts',
            'Too many attempts',
            { retryAfter },
            { 'Retry-After': String(retryAfter) }
        );
    }
}

/** The server could not do what was asked, and left the data as it was. */
export class OperationFailedError extends ApiError {
    constructor(code: ApiErrorCode, message: string, details?: unknown) {
        super(500, code, message, details);
    }
}

/**
 * The 413 for a request body that is too large. It names no limit: adapter-node's BODY_SIZE_LIMIT
 * may stop the body before the limit of the route does.
 */
export function tooLargeError(): ApiError {
    return new ApiError(413, 'body_too_large', 'The request body is too large');
}
