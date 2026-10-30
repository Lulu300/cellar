<script lang="ts">
    import { SquarePen } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import { containerLabel } from '#lib/shared/storage.js';

    /**
     * Opens the dialog of the container. A container without a case says that it adds one: its
     * dialog opens with a first case to add.
     */
    let {
        container,
        onEdit,
        large = false
    }: {
        container: StorageContainerDTO;
        onEdit: (container: StorageContainerDTO) => void;
        large?: boolean;
    } = $props();
</script>

{#if container.cases.length === 0}
    <Button variant="outline" size="sm" onclick={() => onEdit(container)}>
        + {m['storage.add_case']()}
        <span class="sr-only">({containerLabel(container.name)})</span>
    </Button>
{:else}
    <Button
        variant="ghost"
        size="sm"
        onclick={() => onEdit(container)}
        aria-label={m['storage.edit_container_named']({ name: containerLabel(container.name) })}
        class={large ? 'h-8 w-8 p-0' : 'h-6 w-6 p-0'}
    >
        <SquarePen class={large ? 'h-4 w-4' : 'h-3 w-3'} />
    </Button>
{/if}
