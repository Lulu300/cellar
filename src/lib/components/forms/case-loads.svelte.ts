import { request } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import type { Jsonified, StorageCase, StorageContainer } from '#lib/shared/dto.js';
import { containerLabel } from '#lib/shared/storage.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/**
 * The storage cases, in the order of the storage page, and the available bottles that each holds,
 * loaded once: how full a case is shows as soon as it is chosen, without a request per choice
 * whose answer could come after that of a later choice.
 */
export class CaseLoads {
    cases = $state.raw<Jsonified<StorageCase>[]>([]);
    loading = $state(true);
    #containers = $state.raw<Jsonified<StorageContainer>[]>([]);
    #occupancy = $state.raw<Record<string, number>>({});

    async load() {
        try {
            [this.cases, this.#containers, this.#occupancy] = await Promise.all([
                request<Jsonified<StorageCase>[]>('/api/storage-cases'),
                request<Jsonified<StorageContainer>[]>('/api/storage-containers'),
                request<Record<string, number>>('/api/storage-occupancy')
            ]);
        } catch {
            toasts.add(m['bottles.cases_not_loaded'](), 'error', 5000);
        } finally {
            this.loading = false;
        }
    }

    /** The cases container by container, under the name the storage page gives each container. */
    get byContainer() {
        return this.#containers
            .map((container) => ({
                id: container.id,
                name: containerLabel(container.name),
                cases: this.cases.filter(({ containerId }) => containerId === container.id)
            }))
            .filter(({ cases }) => cases.length > 0);
    }

    find(id: string | null | undefined) {
        return this.cases.find((storageCase) => storageCase.id === id);
    }

    /** The available bottles in a case, which take a place each. */
    used(id: string): number {
        return this.#occupancy[id] ?? 0;
    }

    /** The places left in a case; none in a case that holds more than its capacity. */
    free(storageCase: Jsonified<StorageCase>): number {
        return Math.max(0, storageCase.capacity - this.used(storageCase.id));
    }
}
