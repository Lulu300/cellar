<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import CaseLoad from './CaseLoad.svelte';
    import ContainerBadge from './ContainerBadge.svelte';
    import EditContainerButton from './EditContainerButton.svelte';

    /** A card for each container, with its cases in order. */
    let {
        containers,
        highlighted,
        onOpen,
        onEdit
    }: {
        containers: StorageContainerDTO[];
        /** The ids of the cases that hold the wine the page looks for. */
        highlighted: ReadonlySet<string>;
        /** Opens the bottles of a case. */
        onOpen: (storageCase: StorageContainerDTO['cases'][number]) => void;
        /** Shows the button that edits a container; absent for a visitor. */
        onEdit?: (container: StorageContainerDTO) => void;
    } = $props();
</script>

<div class="storage-containers-grid">
    {#each containers as container (container.id)}
        <Card>
            <CardHeader class="pb-2">
                <div class="flex items-center justify-between">
                    <CardTitle class="text-lg flex items-center justify-center flex-1">
                        <ContainerBadge name={container.name} />
                    </CardTitle>
                    {#if onEdit}
                        <EditContainerButton {container} {onEdit} large />
                    {/if}
                </div>
            </CardHeader>
            <CardContent class="space-y-2">
                {#each container.cases as storageCase (storageCase.id)}
                    <CaseLoad
                        {storageCase}
                        compact
                        highlighted={highlighted.has(storageCase.id)}
                        onOpen={() => onOpen(storageCase)}
                    />
                {/each}
            </CardContent>
        </Card>
    {/each}
</div>
