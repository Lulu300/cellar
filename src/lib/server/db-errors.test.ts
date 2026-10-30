import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { insertBottles, insertWineDefinition } from '../../test/wine';
import { refusedWriteError } from './db-errors';

/** The error that SQLite throws for `write`. */
function errorOf(write: () => unknown): unknown {
    try {
        write();
    } catch (error) {
        return error;
    }
    throw new Error('The write was not refused');
}

// The schemas refuse these values first: the CHECK constraints catch a write that skipped them.
describe('refusedWriteError', () => {
    it('names the field that a CHECK constraint refused, as the schemas name theirs', async () => {
        const wineId = await insertWineDefinition();
        await insertBottles(wineId, [{ id: 'b1' }]);

        const rating = errorOf(() =>
            db
                .update(wineDefinitions)
                .set({ rating: 9 })
                .where(eq(wineDefinitions.id, wineId))
                .run()
        );
        const availability = errorOf(() =>
            db
                .update(wineBottles)
                .set({ availability: 'lost' as never })
                .where(eq(wineBottles.id, 'b1'))
                .run()
        );

        expect(refusedWriteError(rating, 'PUT')).toMatchObject({
            status: 422,
            code: 'invalid_body',
            details: [{ path: 'rating', message: 'The rating must be from 1 to 5' }]
        });
        expect(refusedWriteError(availability, 'PATCH')).toMatchObject({
            status: 422,
            code: 'invalid_body',
            details: [{ path: 'availability', message: expect.any(String) }]
        });
    });
});
