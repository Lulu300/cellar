import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { insertBottles, insertWineDefinition } from '../../test/wine';
import { namingMissingReferences, refusedWriteError } from './db-errors';

/** The error that SQLite throws for `write`. */
function errorOf(write: () => unknown): unknown {
    try {
        write();
    } catch (error) {
        return error;
    }
    throw new Error('The write was not refused');
}

let wineId: string;

beforeAll(async () => {
    wineId = await insertWineDefinition();
});

// The schemas refuse these values first: the CHECK constraints catch a write that skipped them.
describe('refusedWriteError', () => {
    it('names the field that a CHECK constraint refused, as the schemas name theirs', async () => {
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

describe('namingMissingReferences', () => {
    const insert = (values: object, fields: object) =>
        errorOf(() =>
            namingMissingReferences(wineBottles, values, db, () =>
                db
                    .insert(wineBottles)
                    .values({ definitionId: wineId, formatId: 'bottle', ...fields })
                    .run()
            )
        );

    it('names each id of the values that refers to no row', () => {
        const fields = { formatId: 'no-format', storageCaseId: 'no-case' };

        expect(insert(fields, fields)).toMatchObject({
            status: 409,
            code: 'missing_reference',
            message:
                'An entry it refers to does not exist (formatId no-format, storageCaseId no-case)',
            details: [
                { field: 'formatId', id: 'no-format' },
                { field: 'storageCaseId', id: 'no-case' }
            ]
        });
    });

    // An id that the values do not give cannot be named: the refusal keeps its general message.
    it('lets a refusal that names none of the values go on as it is', () => {
        const refusal = insert({ formatId: 'bottle' }, { originId: 'no-origin' });

        expect(refusedWriteError(refusal, 'POST')).toEqual(
            expect.objectContaining({
                code: 'missing_reference',
                message: 'An entry it refers to does not exist',
                details: undefined
            })
        );
    });
});
