import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { rejectCrossOriginRequest } from './csrf';

const event = (method: string, origin: string | null) =>
    ({
        request: new Request('http://cellar.local/api/bottles', {
            method,
            headers: origin ? { origin } : {}
        }),
        url: new URL('http://cellar.local/api/bottles')
    }) as unknown as RequestEvent;

describe('rejectCrossOriginRequest', () => {
    it('answers a cross-site write 403 in the API error format, which the UI translates', async () => {
        const response = rejectCrossOriginRequest(event('POST', 'http://evil.example'));

        expect(response?.status).toBe(403);
        expect((await response!.json()).error.code).toBe('cross_site_request');
    });

    it.each([
        ['a read', 'GET', 'http://evil.example'],
        ['a write from its own origin', 'POST', 'http://cellar.local'],
        ['a write without Origin, such as curl', 'POST', null]
    ])('lets %s through', (_, method, origin) => {
        expect(rejectCrossOriginRequest(event(method, origin))).toBeNull();
    });
});
