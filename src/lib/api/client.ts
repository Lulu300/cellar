import { m } from '#lib/paraglide/messages.js';
import type { ApiErrorCode } from '#lib/shared/api-error.js';
import { apiErrorCode, apiErrorMessage } from '#lib/utils/api-error.js';
import { saveResponse, saveUrl } from '#lib/utils/download.js';

/**
 * A request that failed: refused by the API, answered by something else (a proxy page), or never
 * answered (the network). `message` is the text to show, in the user's language.
 */
export class ApiError extends Error {
    constructor(
        /** 0 when no answer came. */
        readonly status: number,
        /** The error body of the API, or null when the answer was not one. */
        readonly body: unknown,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get code(): ApiErrorCode | undefined {
        return apiErrorCode(this.body);
    }

    /** The `details` of the API error, whose shape depends on its code. */
    details<Details>(): Details {
        return (this.body as { error: { details: Details } }).error.details;
    }
}

/** The message to show for anything a request threw. */
export function errorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : m['errors.internal_error']();
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Sent as JSON. */
    json?: unknown;
    /** Sent as is, such as a FormData of files. */
    body?: BodyInit;
}

const unexpectedAnswer = (status: number) =>
    new ApiError(status, null, m['errors.unexpected_response']({ status }));

/** Sends the request, and throws an ApiError for any failure. */
async function send(
    url: string,
    { method = 'GET', json, body }: RequestOptions
): Promise<Response> {
    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers: json === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: json === undefined ? body : JSON.stringify(json)
        });
    } catch {
        // fetch only rejects when no answer came: offline, server down, connection cut.
        throw new ApiError(0, null, m['errors.network_error']());
    }
    if (response.ok) return response;

    const errorBody: unknown = await response.json().catch(() => null);
    if (apiErrorCode(errorBody) === undefined) throw unexpectedAnswer(response.status);
    throw new ApiError(response.status, errorBody, apiErrorMessage(errorBody));
}

/** Calls the API and returns the JSON it answers, or undefined for an empty answer (204). */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const response = await send(url, options);
    if (response.status === 204) return undefined as T;
    try {
        return (await response.json()) as T;
    } catch {
        // A success status with a body that is not JSON: a proxy's page, not the API.
        throw unexpectedAnswer(response.status);
    }
}

/** Calls the API, makes the browser save the file it answers, and returns the file's name. */
export async function downloadBlob(
    url: string,
    fallbackName: string,
    options: RequestOptions = {}
): Promise<string> {
    return saveResponse(await send(url, options), fallbackName);
}

/**
 * Makes the browser download the file at `url` and save it as `filename`, straight to the disk: a
 * backup can be larger than the page's memory. A link alone would fail unseen, so the page first
 * asks for the file and reads only the answer's status: when the server refuses the download or
 * cannot be reached, this throws as a request does, and the body is left unread. The download
 * that the link then starts is not watched: a cut transfer, a full disk, a cancelled save dialog
 * or the browser's prompt for multiple downloads go unseen.
 */
export async function downloadToDisk(url: string, filename: string): Promise<void> {
    const response = await send(url, {});
    await response.body?.cancel();
    saveUrl(url, filename);
}
