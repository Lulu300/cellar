import { text as streamText } from 'node:stream/consumers';
import { z } from 'zod';
import { backupFileRequest } from '#lib/server/features/backup/files.js';
import type { ApiErrorIssue } from '#lib/shared/api-error.js';
import { ApiError, tooLargeError, ValidationError } from './errors.js';

/**
 * The largest JSON body that a route reads, far above what any of them needs: past it, a request
 * would hold memory up to BODY_SIZE_LIMIT (512 MB), which the restore and the imports need.
 */
export const MAX_JSON_BYTES = 1024 * 1024;

/** Reading the body failed because it passed BODY_SIZE_LIMIT: adapter-node then errors with 413. */
function isBodyTooLarge(error: unknown): boolean {
    return (error as { status?: unknown } | null)?.status === 413;
}

/** Whether the Content-Length of `request` announces more than `maxBytes`. */
function isOversizedRequest(request: Request, maxBytes: number): boolean {
    return Number(request.headers.get('content-length')) > maxBytes;
}

/**
 * The body of `request`, which errors with a 413 once it passes `maxBytes`: a body without
 * Content-Length may lie. Throws the 413 at once when the Content-Length announces more. A body
 * that cannot be read, such as one whose client went away, errors with a 400.
 *
 * The rest of the body is left unread, never cancelled: cancelling it makes adapter-node destroy
 * the connection, and the client would get a reset instead of the error.
 */
function limitedBody(request: Request, maxBytes: number): ReadableStream<Uint8Array> {
    if (isOversizedRequest(request, maxBytes)) throw tooLargeError();
    const reader = request.body?.getReader();
    let size = 0;
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            if (!reader) return controller.close();
            let read;
            try {
                read = await reader.read();
            } catch (error) {
                if (isBodyTooLarge(error)) throw tooLargeError();
                throw new ApiError(400, 'malformed_body', 'The request body could not be read');
            }
            if (read.done) return controller.close();
            size += read.value.byteLength;
            if (size > maxBytes) throw tooLargeError();
            controller.enqueue(read.value);
        }
    });
}

/** Each issue of a failed parse, with its path as text, for the `details` of a 422. */
function issuesOf(error: z.ZodError): ApiErrorIssue[] {
    return error.issues.map(({ path, message }) => ({ path: path.join('.'), message }));
}

/** `value` checked against `schema`: the parsed data, or a ValidationError (422) with the issues. */
export function parseWith<Schema extends z.ZodType>(
    schema: Schema,
    value: unknown
): z.output<Schema> {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new ValidationError(
            'invalid_body',
            `Invalid request body: ${z.prettifyError(parsed.error)}`,
            issuesOf(parsed.error)
        );
    }
    return parsed.data;
}

/**
 * The JSON body of `request`, checked against `schema`. Throws an ApiError: 413 for a body over
 * MAX_JSON_BYTES, 400 for one that is not JSON, 422 for one that breaks the schema. An empty body
 * is read as undefined, for the schemas whose body is optional.
 */
export async function parseBody<Schema extends z.ZodType>(
    request: Request,
    schema: Schema
): Promise<z.output<Schema>> {
    const text = await streamText(limitedBody(request, MAX_JSON_BYTES));
    let value: unknown;
    try {
        value = text === '' ? undefined : JSON.parse(text);
    } catch {
        throw new ApiError(400, 'malformed_body', 'The request body is not valid JSON');
    }
    return parseWith(schema, value);
}

/**
 * Room for what a multipart form holds besides its content: the boundaries and the headers of its
 * parts, file names included. Without it, a file just under the limit of its route would be refused.
 */
const FORM_FRAMING_BYTES = 64 * 1024;

/**
 * The multipart form of an upload, whose files and fields hold `maxBytes` at most. Throws an
 * ApiError: 413 when the Content-Length announces more than that plus FORM_FRAMING_BYTES, before
 * the form is buffered in memory, or when the body passes BODY_SIZE_LIMIT; 400 for a body that is
 * not a form. The route still checks the size of each file, which a request without
 * Content-Length (chunked) does not announce.
 */
export async function parseFormData(request: Request, maxBytes: number): Promise<FormData> {
    if (isOversizedRequest(request, maxBytes + FORM_FRAMING_BYTES)) throw tooLargeError();
    try {
        return await request.formData();
    } catch (error) {
        if (isBodyTooLarge(error)) throw tooLargeError();
        throw new ApiError(400, 'malformed_body', 'The request body is not a valid form');
    }
}

/** Where a restore or an import reads its zip: a backup that the server has, or an upload. */
export type ZipSource = { filename: string } | { upload: ReadableStream<Uint8Array> };

/**
 * The zip of a restore or an import, by the Content-Type of `request`. JSON names a backup of the
 * list, `{ "filename": … }`, which the server reads where it is, without the upload limit (those of
 * the extraction still apply). application/zip sends the zip itself as the raw body, which errors
 * with a 413 past `maxBytes`. Throws a 400 for any other content type.
 */
export async function parseZipRequest(request: Request, maxBytes: number): Promise<ZipSource> {
    const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (type === 'application/json') return parseBody(request, backupFileRequest);
    if (type === 'application/zip') return { upload: limitedBody(request, maxBytes) };
    throw new ApiError(
        400,
        'malformed_body',
        'Send the zip as the raw body with Content-Type application/zip, or the file name of a backup as JSON: { "filename": "…" }'
    );
}
