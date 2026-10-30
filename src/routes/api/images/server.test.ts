import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../test/event';
import { insertImageRow } from '../../../test/image';
import { GET } from './+server';

describe('GET /api/images', () => {
    it('gives the id and URL of each image', async () => {
        await insertImageRow('wine-a', 'wine-a.jpg');
        await insertImageRow('wine-b', 'wine-b.png');

        const response = await GET(fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/images' }));

        expect(response.status).toBe(200);
        const { images } = await response.json();
        expect(images).toHaveLength(2);
        expect(images).toEqual(
            expect.arrayContaining([
                { id: 'wine-a', url: '/uploads/wines/wine-a.jpg' },
                { id: 'wine-b', url: '/uploads/wines/wine-b.png' }
            ])
        );
    });
});
