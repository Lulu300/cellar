import { describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries, regions } from '#lib/server/db/schema.js';
import { BarcodeRangeError } from '#lib/shared/barcode.js';
import { fakeEvent } from '../../../test/event';
import { NotFoundError } from './errors';
import { apiHandler } from './handler';

const now = new Date();
const answer = (method: string, handler: () => unknown) =>
    apiHandler(async () => {
        await handler();
        return new Response(null, { status: 204 });
    })(fakeEvent({ method, path: '/api/thing' }));

async function errorOf(response: Response) {
    return { status: response.status, ...(await response.json()).error };
}

describe('apiHandler', () => {
    it('answers an ApiError with its status, code and message', async () => {
        const response = await answer('GET', () => {
            throw new NotFoundError('Wine not found');
        });

        expect(await errorOf(response)).toEqual({
            status: 404,
            code: 'not_found',
            message: 'Wine not found'
        });
    });

    it('answers 409 to a barcode sequence that ran out', async () => {
        const response = await answer('POST', () => {
            throw new BarcodeRangeError('CELLAR', 10_000);
        });

        expect(await errorOf(response)).toMatchObject({ status: 409, code: 'barcode_range' });
    });

    describe('with a write that SQLite refuses', () => {
        it('answers 409 to a name that another row has', async () => {
            await db
                .insert(countries)
                .values({ id: 'fr', name: 'France', createdAt: now, updatedAt: now });

            const response = await answer('POST', () =>
                db
                    .insert(countries)
                    .values({ id: 'fr2', name: 'France', createdAt: now, updatedAt: now })
                    .run()
            );

            expect(await errorOf(response)).toMatchObject({ status: 409, code: 'duplicate_name' });
        });

        it('answers 409 to a reference to a row that does not exist', async () => {
            const response = await answer('POST', () =>
                db
                    .insert(regions)
                    .values({
                        id: 'x',
                        name: 'X',
                        countryId: 'nowhere',
                        createdAt: now,
                        updatedAt: now
                    })
                    .run()
            );

            expect(await errorOf(response)).toMatchObject({
                status: 409,
                code: 'missing_reference'
            });
        });

        it('answers 409 to deleting a row that others still use', async () => {
            await db
                .insert(countries)
                .values({ id: 'fr', name: 'France', createdAt: now, updatedAt: now })
                .onConflictDoNothing();
            await db.insert(regions).values({
                id: 'bdx',
                name: 'Bordeaux',
                countryId: 'fr',
                createdAt: now,
                updatedAt: now
            });

            const response = await answer('DELETE', () => db.delete(countries).run());

            expect(await errorOf(response)).toMatchObject({ status: 409, code: 'in_use' });
        });
    });

    it('answers 500 to any other error, without its details, and logs it', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});

        const response = await answer('GET', () => {
            throw new Error('/data/cellar.db is locked');
        });

        expect(await errorOf(response)).toEqual({
            status: 500,
            code: 'internal_error',
            message: 'Internal server error'
        });
        expect(log).toHaveBeenCalledWith('GET /api/thing failed:', expect.any(Error));
    });
});
