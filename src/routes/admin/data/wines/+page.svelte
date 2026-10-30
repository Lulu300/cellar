<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import EntityListPanel from '#lib/components/admin/EntityListPanel.svelte';
    import FilterSelect from '#lib/components/admin/FilterSelect.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { EntityCollection } from '#lib/components/admin/entity-collection.svelte.js';
    import { wineLabel } from '#lib/components/admin/wine-labels.js';
    import { ApiError, errorMessage } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { AdminDefinitionDTO } from '#lib/shared/dto.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const NO_FILTERS = { color: '', type: '', country: '', region: '', appellation: '' };
    let filter = $state({ ...NO_FILTERS });

    const collection = new EntityCollection<AdminDefinitionDTO>(
        () => data.items,
        '/api/admin/wine-definitions',
        (wine, query) =>
            [
                wine.name,
                wine.producer,
                wine.appellationName,
                wine.regionName,
                wine.countryName
            ].some((text) => text?.toLowerCase().includes(query)) &&
            (!filter.color || wine.colorId === filter.color) &&
            (!filter.type || wine.typeId === filter.type) &&
            (!filter.country || wine.countryId === filter.country) &&
            (!filter.region || wine.regionId === filter.region) &&
            (!filter.appellation || wine.appellationId === filter.appellation)
    );

    const options = (rows: { id: string; name: string }[]) =>
        rows.map((row) => ({ value: row.id, label: row.name }));
    const { references } = $derived(data);
    const regions = $derived(
        references.regions.filter(
            (region) => !filter.country || region.countryId === filter.country
        )
    );
    const appellations = $derived(
        data.appellations.filter(
            (appellation) =>
                (!filter.region || appellation.regionId === filter.region) &&
                regions.some((region) => region.id === appellation.regionId)
        )
    );

    function clearFilters() {
        filter = { ...NO_FILTERS };
        collection.page = 1;
    }

    async function remove(wine: AdminDefinitionDTO) {
        const name = wineLabel(wine);
        if (!(await confirm({ message: m['admin.confirm_delete_wine']({ name }) }))) {
            return;
        }
        try {
            await collection.remove(wine.id);
            toasts.add(m['toast.wine_definition_deleted'](), 'success');
        } catch (error) {
            if (error instanceof ApiError && error.code === 'in_use') {
                // The cascade question says it better than the general message under the row.
                delete collection.inUse[wine.id];
                await removeWithBottles(wine, error.details<{ bottleCount: number }>().bottleCount);
            } else {
                toasts.add(errorMessage(error), 'error');
            }
        }
    }

    // The wine still has bottles: deleting it deletes them too, once confirmed.
    async function removeWithBottles(wine: AdminDefinitionDTO, count: number) {
        const message = m['admin.confirm_cascade_delete']({ count });
        if (!(await confirm({ message, confirmLabel: m['admin.delete_all']() }))) return;
        try {
            await collection.remove(wine.id, '?cascade=true');
            toasts.add(m['toast.wine_definition_and_bottles_deleted']({ count }), 'success');
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        }
    }
</script>

<svelte:head>
    <title>{pageTitle(m['common.wines'](), m['admin.title']())}</title>
</svelte:head>

<EntityListPanel
    {collection}
    title={m['common.wines']()}
    searchPlaceholder={m['wines.search_placeholder']()}
    onDelete={remove}
    onClearFilters={clearFilters}
>
    {#snippet filters()}
        <FilterSelect
            bind:value={filter.color}
            allLabel={m['common.all_colors']()}
            options={options(references.wineColors)}
            onchange={() => (collection.page = 1)}
        />
        <FilterSelect
            bind:value={filter.type}
            allLabel={m['common.all_types']()}
            options={options(references.wineTypes)}
            onchange={() => (collection.page = 1)}
        />
        <FilterSelect
            bind:value={filter.country}
            allLabel={m['common.all_countries']()}
            options={options(references.countries)}
            onchange={() => {
                filter.region = '';
                filter.appellation = '';
                collection.page = 1;
            }}
        />
        <FilterSelect
            bind:value={filter.region}
            allLabel={m['common.all_regions']()}
            options={options(regions)}
            onchange={() => {
                filter.appellation = '';
                collection.page = 1;
            }}
        />
        <FilterSelect
            bind:value={filter.appellation}
            allLabel={m['admin.all_appellations']()}
            options={options(appellations)}
            onchange={() => (collection.page = 1)}
        />
    {/snippet}
    {#snippet entry(wine)}
        <div class="flex flex-wrap items-center gap-2">
            {#if wine.producer}<Badge variant="outline">{wine.producer}</Badge>{/if}
            <span class="font-medium">{wine.name}</span>
        </div>
        <p class="text-sm text-muted-foreground">
            {wine.appellationName}, {wine.regionName}, {wine.countryName}
        </p>
        <p class="text-sm text-muted-foreground">
            {[wine.typeName, wine.colorName, wine.classificationName].filter(Boolean).join(' • ')}
        </p>
    {/snippet}
</EntityListPanel>
