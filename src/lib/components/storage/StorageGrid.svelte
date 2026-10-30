<script lang="ts">
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import CaseLoad from './CaseLoad.svelte';
    import EditContainerButton from './EditContainerButton.svelte';
    import { containerLabel } from '#lib/shared/storage.js';
    import { containerColor } from './storage.js';

    /** A card for each container, with its cases in order. */
    let {
        containers,
        onEdit
    }: {
        containers: StorageContainerDTO[];
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
                        <Badge class={containerColor(container.name)}>
                            {containerLabel(container.name)}
                        </Badge>
                    </CardTitle>
                    {#if onEdit}
                        <EditContainerButton {container} {onEdit} large />
                    {/if}
                </div>
            </CardHeader>
            <CardContent class="space-y-2">
                {#each container.cases as storageCase (storageCase.id)}
                    <CaseLoad {storageCase} compact />
                {/each}
            </CardContent>
        </Card>
    {/each}
</div>
