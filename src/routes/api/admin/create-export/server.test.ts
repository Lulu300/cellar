import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../../test/event';
import { POST } from './+server';

describe('POST /api/admin/create-export', () => {
    it('answers the new file, its number of rows, and whether an import would take it', async () => {
        const response = await POST(
            fakeEvent<Parameters<typeof POST>[0]>({
                method: 'POST',
                path: '/api/admin/create-export',
                routeId: '/api/admin/create-export',
                body: { name: 'autumn' }
            })
        );

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            success: true,
            message: expect.any(String),
            files: {
                zip: {
                    filename: expect.stringMatching(/^cellar-export-autumn-.+\.zip$/),
                    size: expect.any(Number)
                }
            },
            recordCount: expect.any(Number),
            restorable: true
        });
    });
});
