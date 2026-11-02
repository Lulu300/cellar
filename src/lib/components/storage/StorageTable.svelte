<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import CaseLoad from './CaseLoad.svelte';
    import ContainerBadge from './ContainerBadge.svelte';
    import EditContainerButton from './EditContainerButton.svelte';

    /**
     * The containers side by side, their cases lined up by position: the first case of each on
     * the first line, and so on. As columns or as rows.
     */
    let {
        containers,
        containersAsColumns,
        highlighted,
        onOpen,
        onEdit
    }: {
        containers: StorageContainerDTO[];
        containersAsColumns: boolean;
        /** The ids of the cases that hold the wine the page looks for. */
        highlighted: ReadonlySet<string>;
        /** Opens the bottles of a case. */
        onOpen: (storageCase: StorageContainerDTO['cases'][number]) => void;
        /** Shows the button that edits a container; absent for a visitor. */
        onEdit?: (container: StorageContainerDTO) => void;
    } = $props();

    /** The positions of the cases, from 0, as many as the fullest container has. */
    const positions = $derived(
        Array.from(
            { length: Math.max(0, ...containers.map(({ cases }) => cases.length)) },
            (_, i) => i
        )
    );
</script>

{#snippet containerHeader(container: StorageContainerDTO)}
    <div class="flex flex-col items-center gap-1">
        <ContainerBadge name={container.name} />
        {#if onEdit}
            <EditContainerButton {container} {onEdit} />
        {/if}
    </div>
{/snippet}

{#snippet caseCell(container: StorageContainerDTO, position: number)}
    {@const storageCase = container.cases[position]}
    {#if storageCase}
        <td class="border p-1 text-center">
            <CaseLoad
                {storageCase}
                highlighted={highlighted.has(storageCase.id)}
                onOpen={() => onOpen(storageCase)}
            />
        </td>
    {:else}
        <td class="border p-2 bg-muted/30 text-center text-muted-foreground">
            <span class="text-xs opacity-50">—</span>
        </td>
    {/if}
{/snippet}

<div class="overflow-x-auto">
    <table class="w-full border-collapse">
        {#if containersAsColumns}
            <thead>
                <tr>
                    <th class="border p-2 bg-muted font-medium text-left">{m['storage.case']()}</th>
                    {#each containers as container (container.id)}
                        <th class="border p-2 bg-muted font-medium text-center min-w-[120px]">
                            {@render containerHeader(container)}
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each positions as position (position)}
                    <tr>
                        <td class="border p-2 font-medium bg-muted/50 text-center">
                            {position + 1}
                        </td>
                        {#each containers as container (container.id)}
                            {@render caseCell(container, position)}
                        {/each}
                    </tr>
                {/each}
            </tbody>
        {:else}
            <thead>
                <tr>
                    <th class="border p-2 bg-muted font-medium text-left">
                        {m['storage.container']()}
                    </th>
                    {#each positions as position (position)}
                        <th class="border p-2 bg-muted font-medium text-center min-w-[120px]">
                            {position + 1}
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each containers as container (container.id)}
                    <tr>
                        <th scope="row" class="border p-2 font-medium bg-muted/50 text-center">
                            {@render containerHeader(container)}
                        </th>
                        {#each positions as position (position)}
                            {@render caseCell(container, position)}
                        {/each}
                    </tr>
                {/each}
            </tbody>
        {/if}
    </table>
</div>
