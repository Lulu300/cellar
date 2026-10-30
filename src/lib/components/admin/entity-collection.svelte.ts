import { invalidateAll } from '$app/navigation';
import { SvelteSet } from 'svelte/reactivity';
import { ApiError, request } from '#lib/api/client.js';
import { clampPage } from '#lib/utils/pagination.js';

export const PER_PAGE = 10;

/**
 * A list of the admin, loaded by the page: its search, its page, and its deletions. A deletion
 * that the API refuses because the entry is in use keeps the reason next to the entry.
 */
export class EntityCollection<T extends { id: string }> {
    query = $state('');
    #page = $state(1);
    /** Why the API refused to delete an entry, by id. */
    inUse = $state<Record<string, string>>({});
    /** The entries being deleted. */
    readonly deleting = new SvelteSet<string>();

    readonly #items: () => T[];
    readonly #matches: (item: T, query: string) => boolean;

    /**
     * @param items the entries, read on each use: the page's data, which a reload replaces
     * @param endpoint the URL of the API collection: DELETE goes to `<endpoint>/<id>`
     * @param matches whether an entry matches the search, given in lower case, and any other
     * filter of the page; called with an empty search too
     */
    constructor(
        items: () => T[],
        readonly endpoint: string,
        matches: (item: T, query: string) => boolean
    ) {
        this.#items = items;
        this.#matches = matches;
    }

    get items(): T[] {
        return this.#items();
    }

    filtered = $derived.by(() => {
        const query = this.query.trim().toLowerCase();
        return this.items.filter((item) => this.#matches(item, query));
    });

    /** The page shown: the last one once the list has shrunk below it, after a deletion. */
    get page(): number {
        return clampPage(this.#page, this.filtered.length, PER_PAGE);
    }

    set page(page: number) {
        this.#page = page;
    }

    paged = $derived(this.filtered.slice((this.page - 1) * PER_PAGE, this.page * PER_PAGE));

    /** Changes the search, which starts again from the first page. */
    search(query: string) {
        this.query = query;
        this.#page = 1;
    }

    /**
     * Deletes the entry, then reloads the page's data. An entry already deleted, in another tab
     * say, counts as deleted: the reload drops it. Throws the ApiError of a refusal; an `in_use`
     * one is also kept in `inUse`.
     */
    async remove(id: string, query = ''): Promise<void> {
        delete this.inUse[id];
        this.deleting.add(id);
        try {
            await request(`${this.endpoint}/${id}${query}`, { method: 'DELETE' });
            await invalidateAll();
        } catch (error) {
            if (error instanceof ApiError && error.code === 'not_found') {
                await invalidateAll();
                return;
            }
            if (error instanceof ApiError && error.code === 'in_use') {
                this.inUse[id] = error.message;
            }
            throw error;
        } finally {
            this.deleting.delete(id);
        }
    }
}
