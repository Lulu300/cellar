import { SvelteSet } from 'svelte/reactivity';
import { matchesImageSearch, type SearchedImage } from '#lib/utils/image-search.js';

/**
 * The search and the selection of the image page. Only images in view are ever selected, so that
 * "Delete selected" removes exactly what the user sees (decision of 2026-10-11).
 */
export class ImageSelection<T extends SearchedImage> {
    query = $state('');
    readonly #ids = new SvelteSet<string>();
    readonly #images: () => T[];

    /** @param images the images, read on each use: the page's data, which a reload replaces */
    constructor(images: () => T[]) {
        this.#images = images;
    }

    /** The images that the search finds. */
    visible = $derived.by(() =>
        this.#images().filter((image) => matchesImageSearch(image, this.query))
    );

    /** The ids selected, among the images still there: a deleted image drops out. */
    ids = $derived(
        this.visible.filter((image) => this.#ids.has(image.id)).map((image) => image.id)
    );

    allSelected = $derived(this.ids.length > 0 && this.ids.length === this.visible.length);

    /** Changes the search; the selection loses the images it hides. */
    search(query: string) {
        this.query = query;
        // `ids` already keeps only the selected images in view.
        const kept = this.ids;
        for (const id of this.#ids) if (!kept.includes(id)) this.#ids.delete(id);
    }

    has(id: string) {
        return this.#ids.has(id);
    }

    toggle(id: string, selected: boolean) {
        if (selected) this.#ids.add(id);
        else this.#ids.delete(id);
    }

    /** Selects every image in view, or none when they all are. */
    toggleAll() {
        if (this.allSelected) this.#ids.clear();
        else for (const image of this.visible) this.#ids.add(image.id);
    }
}
