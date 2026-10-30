import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '#lib/api/client.js';
import { EntityCollection, PER_PAGE } from './entity-collection.svelte';

const invalidateAll = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('$app/navigation', () => ({ invalidateAll }));

afterEach(() => {
    vi.unstubAllGlobals();
    invalidateAll.mockClear();
});

interface Row {
    id: string;
    name: string;
}

const rows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: `id${i + 1}`, name: `Wine ${i + 1}` }));

function collection(items: Row[]) {
    const data = { items };
    const list = new EntityCollection(
        () => data.items,
        '/api/wine-types',
        (row, query) => row.name.toLowerCase().includes(query)
    );
    return { list, data };
}

describe('EntityCollection', () => {
    it('shows the entries of the current page', () => {
        const { list } = collection(rows(25));

        list.page = 3;

        expect(list.paged.map((row) => row.id)).toEqual(['id21', 'id22', 'id23', 'id24', 'id25']);
    });

    it('searches without case, and starts again from the first page', () => {
        const { list } = collection(rows(25));
        list.page = 2;

        list.search('WINE 1');

        expect(list.page).toBe(1);
        expect(list.filtered.map((row) => row.name)).toEqual([
            'Wine 1',
            ...rows(19)
                .slice(9)
                .map((row) => row.name)
        ]);
    });

    it('shows the last page once the list has shrunk below the current one', () => {
        const { list, data } = collection(rows(2 * PER_PAGE + 1));
        list.page = 3;

        data.items = rows(2 * PER_PAGE);

        expect(list.page).toBe(2);
        expect(list.paged).toHaveLength(PER_PAGE);
    });

    it('deletes an entry, then reloads the data of the page', async () => {
        const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
        vi.stubGlobal('fetch', fetch);
        const { list } = collection(rows(1));

        await list.remove('id1');

        expect(fetch).toHaveBeenCalledWith(
            '/api/wine-types/id1',
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(invalidateAll).toHaveBeenCalled();
        expect(list.deleting.size).toBe(0);
    });

    // Another tab may have deleted it: the user wanted it gone, and the reload drops its row.
    it('counts an entry already deleted as deleted, and reloads the data of the page', async () => {
        const gone = { error: { code: 'not_found', message: 'Wine bottle not found' } };
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(Response.json(gone, { status: 404 })))
        );
        const { list } = collection(rows(1));

        await expect(list.remove('id1')).resolves.toBeUndefined();

        expect(invalidateAll).toHaveBeenCalled();
        expect(list.deleting.size).toBe(0);
    });

    it('keeps why an entry in use cannot be deleted, until it is deleted again', async () => {
        const inUse = {
            code: 'in_use',
            message: 'In use',
            details: { usedBy: 'bottles', count: 3 }
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(Response.json({ error: inUse }, { status: 409 })))
        );
        const { list } = collection(rows(1));

        await expect(list.remove('id1')).rejects.toBeInstanceOf(ApiError);

        expect(list.inUse.id1).toBe(
            'This item is still used by 3 bottles, so it cannot be deleted.'
        );
        expect(invalidateAll).not.toHaveBeenCalled();

        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
        );
        await list.remove('id1');
        expect(list.inUse.id1).toBeUndefined();
    });
});
