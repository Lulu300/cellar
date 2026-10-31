import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../test/event';
import { GET } from './+server';

describe('GET /api/openapi.json', () => {
    it('serves the description of docs/openapi.json', async () => {
        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/openapi.json' })
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(await response.json()).toEqual(
            JSON.parse(readFileSync('docs/openapi.json', 'utf8'))
        );
    });
});
