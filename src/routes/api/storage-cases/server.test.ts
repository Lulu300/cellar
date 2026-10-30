import { describe, expect, it } from 'vitest';
import { createContainer } from '#lib/server/features/storage/service.js';
import { fakeEvent } from '../../../test/event';
import { GET } from './+server';

describe('GET /api/storage-cases', () => {
    it('lists every case, container by container, each in the order of its container', async () => {
        createContainer({ name: 'Shelf', cases: ['1'], caseCapacities: [] });
        const rack = createContainer({ name: 'Rack', cases: ['2', '1'], caseCapacities: [12] });

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/storage-cases' })
        );

        expect(response.status).toBe(200);
        const cases = await response.json();
        expect(cases.map((c: { name: string }) => c.name)).toEqual(['Rack2', 'Rack1', 'Shelf1']);
        expect(cases[0]).toEqual({
            id: rack.cases[0].id,
            name: 'Rack2',
            capacity: 12,
            containerId: rack.container.id,
            position: 0,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
        });
        expect(cases[1]).toMatchObject({ capacity: 5, position: 1 });
    });
});
