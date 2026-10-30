import { afterEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { fakeLink } from '../../test/link';
import { ApiError, downloadBlob, downloadToDisk, request } from './client';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function answer(response: Response | Error) {
    const fetch = vi.fn(() =>
        response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

/** What `request` throws, or fails the test when it resolves. */
async function failure(promise: Promise<unknown>): Promise<ApiError> {
    const error = await promise.then(
        () => expect.fail('the request should fail'),
        (error: unknown) => error
    );
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
}

const apiError = (status: number, code: string, details?: unknown) =>
    Response.json({ error: { code, message: 'In English', details } }, { status });

describe('request', () => {
    it('sends JSON and returns the JSON answer', async () => {
        const fetch = answer(Response.json({ id: 'a1', name: 'France' }, { status: 201 }));

        const row = await request<{ id: string }>('/api/countries', {
            method: 'POST',
            json: { name: 'France' }
        });

        expect(row).toEqual({ id: 'a1', name: 'France' });
        expect(fetch).toHaveBeenCalledWith('/api/countries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"name":"France"}'
        });
    });

    it('returns undefined for an empty answer', async () => {
        answer(new Response(null, { status: 204 }));

        expect(await request('/api/countries/a1', { method: 'DELETE' })).toBeUndefined();
    });

    it('throws the translated message, the code and the details of an API error', async () => {
        answer(apiError(409, 'in_use', { usedBy: 'regions', count: 2 }));

        const error = await failure(request('/api/countries/a1', { method: 'DELETE' }));

        expect(error.status).toBe(409);
        expect(error.code).toBe('in_use');
        expect(error.details()).toEqual({ usedBy: 'regions', count: 2 });
        expect(error.message).toBe('This item still holds 2 regions, so it cannot be deleted.');
    });

    it('reads a proxy page that is not JSON as an unexpected answer, with its status', async () => {
        answer(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

        const error = await failure(request('/api/admin/list-backups'));

        expect(error.status).toBe(502);
        expect(error.code).toBeUndefined();
        expect(error.message).toContain('HTTP 502');
    });

    it('reads JSON that is not an API error, such as a 404 page, as an unexpected answer', async () => {
        answer(Response.json({ message: 'Not Found' }, { status: 404 }));

        const error = await failure(request('/api/unknown'));

        expect(error.code).toBeUndefined();
        expect(error.message).toContain('HTTP 404');
    });

    it('reads a success answer that is not JSON as an unexpected answer', async () => {
        answer(new Response('<html>Login to the proxy</html>', { status: 200 }));

        const error = await failure(request('/api/admin/list-backups'));

        expect(error.message).toContain('HTTP 200');
    });

    it('turns a network failure into an error with status 0 and a message to show', async () => {
        answer(new TypeError('Failed to fetch'));

        const error = await failure(request('/api/admin/restore', { method: 'POST' }));

        expect(error.status).toBe(0);
        expect(error.message).toBe(m['errors.network_error']());
    });
});

describe('downloadBlob', () => {
    it('saves the file under the name of its Content-Disposition and returns that name', async () => {
        const link = fakeLink();
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
        vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
        answer(
            new Response('zip', {
                headers: {
                    'Content-Disposition': `attachment; filename*=UTF-8''cave-%C3%A9t%C3%A9.zip`
                }
            })
        );

        const name = await downloadBlob('/api/admin/download-backup?filename=x', 'backup.zip');

        expect(name).toBe('cave-été.zip');
        expect(link.download).toBe('cave-été.zip');
        expect(link.click).toHaveBeenCalled();
    });

    it('saves nothing and throws when the download is refused', async () => {
        const link = fakeLink();
        answer(apiError(404, 'not_found'));

        const error = await failure(downloadBlob('/api/admin/download-backup?filename=x', 'x.zip'));

        expect(error.code).toBe('not_found');
        expect(link.click).not.toHaveBeenCalled();
    });
});

describe('downloadToDisk', () => {
    // What it does once the server agrees is tested through its callers, in backup-downloads.test.ts.
    it('saves nothing and throws the reason when the download is refused', async () => {
        const link = fakeLink();
        answer(apiError(404, 'not_found'));

        const error = await failure(
            downloadToDisk('/api/admin/download-backup?filename=big.zip', 'big.zip')
        );

        expect(error.message).toBe(m['errors.not_found']());
        expect(link.click).not.toHaveBeenCalled();
    });
});
