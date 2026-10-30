import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { text } from 'node:stream/consumers';
import { MAX_JSON_BYTES, parseBody, parseFormData, parseZipRequest } from './body';
import { ApiError } from './errors';
import { encodedForm } from '../../../test/event';

const schema = z.object({ name: z.string().min(1), count: z.int().max(10).optional() });

const request = (body: BodyInit | null) =>
    new Request('http://localhost/api/thing', { method: 'POST', body });

/** The error that `promise` rejects with. */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
    const error = await promise.then(
        () => undefined,
        (error: unknown) => error
    );
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
}

describe('parseBody', () => {
    it('gives the data the schema parsed', async () => {
        expect(await parseBody(request('{"name":"Rack","extra":1}'), schema)).toEqual({
            name: 'Rack'
        });
    });

    it('answers 400 to a body that is not JSON', async () => {
        const error = await rejection(parseBody(request('{"name":'), schema));

        expect(error).toMatchObject({ status: 400, code: 'malformed_body' });
    });

    it('answers 422 with each issue to a body the schema refuses', async () => {
        const error = await rejection(parseBody(request('{"name":"","count":11}'), schema));

        expect(error).toMatchObject({ status: 422, code: 'invalid_body' });
        expect((error.details as { path: string }[]).map((issue) => issue.path)).toEqual([
            'name',
            'count'
        ]);
    });

    it('reads an empty body as undefined, for the schemas whose body is optional', async () => {
        expect(await parseBody(request(null), schema.optional())).toBeUndefined();
        expect(await rejection(parseBody(request(null), schema))).toMatchObject({ status: 422 });
    });

    it('answers 413 to a body over BODY_SIZE_LIMIT', async () => {
        // adapter-node errors the body stream with a 413 once the body passes the limit.
        const tooLarge = new ReadableStream({
            start(controller) {
                controller.error(Object.assign(new Error('Payload Too Large'), { status: 413 }));
            }
        });

        const error = await rejection(
            parseBody(
                new Request('http://localhost/api/thing', {
                    method: 'POST',
                    body: tooLarge,
                    duplex: 'half'
                } as RequestInit),
                schema
            )
        );

        expect(error).toMatchObject({ status: 413, code: 'body_too_large' });
    });
});

describe('a body that cannot be read', () => {
    /** A request whose client went away: adapter-node errors its body. */
    function aborted(contentType: string) {
        const body = new ReadableStream({
            start(controller) {
                controller.error(Object.assign(new Error('aborted'), { code: 'ECONNRESET' }));
            }
        });
        return new Request('http://localhost/api/thing', {
            method: 'POST',
            body,
            headers: { 'content-type': contentType },
            duplex: 'half'
        } as RequestInit);
    }

    it('answers 400 to a JSON body', async () => {
        expect(await rejection(parseBody(aborted('application/json'), schema))).toMatchObject({
            status: 400,
            code: 'malformed_body'
        });
    });

    it('answers 400 to a zip upload', async () => {
        const source = await parseZipRequest(aborted('application/zip'), 1000);

        expect('upload' in source && (await rejection(text(source.upload)))).toMatchObject({
            status: 400,
            code: 'malformed_body'
        });
    });
});

describe('parseBody with a body over MAX_JSON_BYTES', () => {
    it('answers 413 from its Content-Length, before reading it', async () => {
        const announced = new Request('http://localhost/api/thing', {
            method: 'POST',
            body: '{}',
            headers: { 'content-length': String(MAX_JSON_BYTES + 1) }
        });

        expect(await rejection(parseBody(announced, schema))).toMatchObject({
            status: 413,
            code: 'body_too_large'
        });
    });

    it('answers 413 to a chunked body once it passes the limit, and stops reading it', async () => {
        let chunksRead = 0;
        const chunk = new Uint8Array(64 * 1024).fill(32);
        // Cancelling the body of a request makes adapter-node reset the connection, before the
        // client gets the 413.
        const cancel = vi.fn();
        const endless = new ReadableStream({
            pull(controller) {
                chunksRead += 1;
                controller.enqueue(chunk);
            },
            cancel
        });
        const chunked = new Request('http://localhost/api/thing', {
            method: 'POST',
            body: endless,
            duplex: 'half'
        } as RequestInit);

        expect(await rejection(parseBody(chunked, schema))).toMatchObject({ status: 413 });
        expect(chunksRead).toBeLessThan(20);
        expect(cancel).not.toHaveBeenCalled();
    });
});

describe('parseFormData', () => {
    const upload = (body: BodyInit, headers: Record<string, string> = {}) =>
        new Request('http://localhost/api/upload/image', { method: 'POST', body, headers });

    it('gives the form', async () => {
        const form = new FormData();
        form.set('image', new File(['bytes'], 'label.jpg'));

        expect((await parseFormData(upload(form), 1000)).get('image')).toBeInstanceOf(File);
    });

    it('answers 400 to a body that is not a form', async () => {
        const error = await rejection(
            parseFormData(upload('{"image": 1}', { 'content-type': 'application/json' }), 1000)
        );

        expect(error).toMatchObject({ status: 400, code: 'malformed_body' });
    });

    it('counts the content of the form against the limit, not the framing of its parts', async () => {
        const form = new FormData();
        form.set('image', new File([new Uint8Array(1000)], 'label.jpg'));
        const { body, headers } = await encodedForm(form);

        expect(body.size).toBeGreaterThan(1000);
        expect((await parseFormData(upload(body, headers), 1000)).get('image')).toBeInstanceOf(
            File
        );
    });

    it('answers 413 to a Content-Length far over the limit, before reading the body', async () => {
        const error = await rejection(
            parseFormData(upload('x', { 'content-length': '100000' }), 1000)
        );

        expect(error).toMatchObject({ status: 413, code: 'body_too_large' });
    });
});

describe('parseZipRequest', () => {
    const send = (body: BodyInit, contentType: string) =>
        new Request('http://localhost/api/admin/restore', {
            method: 'POST',
            body,
            headers: { 'content-type': contentType }
        });

    it('gives the file name of a backup sent as JSON', async () => {
        const named = send('{"filename":"cellar-backup-a.zip"}', 'application/json');

        expect(await parseZipRequest(named, 1000)).toEqual({ filename: 'cellar-backup-a.zip' });
    });

    it('gives a zip sent as the raw body as a stream, whatever the case of its type', async () => {
        const source = await parseZipRequest(send('zip bytes', 'Application/Zip'), 1000);

        expect('upload' in source && (await text(source.upload))).toBe('zip bytes');
    });

    it('answers 400 to a form, the body that older versions took', async () => {
        const form = new FormData();
        form.set('file', new File(['zip bytes'], 'cellar-backup-a.zip'));
        const request = new Request('http://localhost/api/admin/restore', {
            method: 'POST',
            body: form
        });

        expect(await rejection(parseZipRequest(request, 1000))).toMatchObject({
            status: 400,
            code: 'malformed_body'
        });
    });
});
