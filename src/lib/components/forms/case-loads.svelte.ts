import { request } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import type { Jsonified, StorageCase } from '#lib/shared/dto.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * The storage cases, in the order of the storage page, and the available bottles that each holds,
 * loaded once: how full a case is shows as soon as it is chosen, without a request per choice
 * whose answer could come after that of a later choice.
 */
export class CaseLoads {
    cases = $state.raw<Jsonified<StorageCase>[]>([]);
    loading = $state(true);
    #occupancy = $state.raw<Record<string, number>>({});

    async load() {
        try {
            [this.cases, this.#occupancy] = await Promise.all([
                request<Jsonified<StorageCase>[]>('/api/storage-cases'),
                request<Record<string, number>>('/api/storage-occupancy')
            ]);
        } catch {
            toasts.add(m['bottles.cases_not_loaded'](), 'error', 5000);
        } finally {
            this.loading = false;
        }
    }

    find(id: string | null | undefined) {
        return this.cases.find((storageCase) => storageCase.id === id);
    }

    /** The available bottles in a case, which take a place each. */
    used(id: string): number {
        return this.#occupancy[id] ?? 0;
    }
}
