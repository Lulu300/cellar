<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import EntityListPanel from '#lib/components/admin/EntityListPanel.svelte';
    import EntityFormDialog from '#lib/components/admin/EntityFormDialog.svelte';
    import MergeProducersDialog from '#lib/components/admin/dialogs/MergeProducersDialog.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { ProducerDTO } from '#lib/shared/dto.js';
    import WineColorBadge from '#lib/components/wines/WineColorBadge.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { EntityCollection } from '#lib/components/admin/entity-collection.svelte.js';
    import {
        REFERENCE_ENTITIES,
        matchesReference,
        referenceDetail
    } from '#lib/components/admin/entities.js';
    import type { ReferenceRow } from '#lib/shared/reference-tables.js';
    import { errorMessage } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    // Unchanged by a reload of the data, unlike `data` itself.
    const slug = $derived(data.slug);
    const entity = $derived(REFERENCE_ENTITIES[slug]);
    const labels = $derived(entity.labels());
    // One per entity: the search and the page start afresh on another entity, not on a reload.
    const collection = $derived(
        new EntityCollection(() => data.items, `/api/${slug}`, matchesReference)
    );

    // The countries of a region, the regions of an appellation: lists of the root layout.
    const parents = $derived(
        entity.parent === 'countryId'
            ? data.references.countries
            : entity.parent === 'regionId'
              ? data.references.regions
              : []
    );

    let formOpen = $state(false);
    let mergeOpen = $state(false);
    let editing = $state<ReferenceRow | null>(null);

    function openForm(row: ReferenceRow | null) {
        editing = row;
        formOpen = true;
    }

    async function remove(row: ReferenceRow) {
        if (!(await confirm({ message: labels.confirmDelete(row.name) }))) return;
        try {
            await collection.remove(row.id);
            toasts.add(labels.deleted, 'success');
        } catch (error) {
            toasts.add(errorMessage(error), 'error', 8000);
        }
    }
</script>

<svelte:head>
    <title>{pageTitle(labels.title, m['admin.title']())}</title>
</svelte:head>

{#if entity.mergeable}
    <div class="mb-4 flex justify-end">
        <Button variant="outline" onclick={() => (mergeOpen = true)}>
            {m['admin.merge_producers']()}
        </Button>
    </div>
{/if}

<EntityListPanel
    {collection}
    title={labels.title}
    searchPlaceholder={labels.search}
    addLabel={labels.add}
    onAdd={() => openForm(null)}
    onEdit={openForm}
    onDelete={remove}
>
    {#snippet entry(row)}
        {#if row.hex}
            <WineColorBadge name={row.name} hex={row.hex} />
        {:else}
            <Badge variant="outline">{row.name}</Badge>
        {/if}
        {#if referenceDetail(row)}
            <p class="mt-1 text-xs text-muted-foreground">{referenceDetail(row)}</p>
        {/if}
        {#if row.wineCount !== undefined}
            <p class="mt-1 text-xs text-muted-foreground">
                {m['producers.n_wines']({ count: row.wineCount })}
            </p>
        {/if}
    {/snippet}
</EntityListPanel>

<EntityFormDialog bind:open={formOpen} {entity} {editing} items={data.items} {parents} />

{#if entity.mergeable}
    <MergeProducersDialog
        bind:open={mergeOpen}
        producers={data.items as ProducerDTO[]}
        imageUrls={data.imageUrls}
    />
{/if}
