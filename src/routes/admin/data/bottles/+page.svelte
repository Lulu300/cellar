<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import EntityListPanel from '#lib/components/admin/EntityListPanel.svelte';
    import FilterSelect from '#lib/components/admin/FilterSelect.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { EntityCollection } from '#lib/components/admin/entity-collection.svelte.js';
    import { bottleLabel } from '#lib/components/admin/wine-labels.js';
    import { availabilityLabel } from '#lib/components/bottles/availability.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import { errorMessage } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { AdminBottleDTO } from '#lib/shared/dto.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const NO_FILTERS = { format: '', vintage: '', availability: '' };
    let filter = $state({ ...NO_FILTERS });

    const collection = new EntityCollection<AdminBottleDTO>(
        () => data.items,
        '/api/bottles',
        (bottle, query) =>
            [
                bottle.wineName,
                bottle.producer,
                bottle.vintage?.toString(),
                bottle.appellationName,
                bottle.regionName,
                bottle.countryName,
                bottle.barcode
            ].some((text) => text?.toLowerCase().includes(query)) &&
            (!filter.format || bottle.formatId === filter.format) &&
            (!filter.vintage || bottle.vintage?.toString() === filter.vintage) &&
            (!filter.availability || bottle.availability === filter.availability)
    );

    const vintages = $derived(
        [...new Set(data.items.map((bottle) => bottle.vintage).filter((year) => year != null))]
            .sort((a, b) => b - a)
            .map((year) => ({ value: String(year), label: String(year) }))
    );

    function clearFilters() {
        filter = { ...NO_FILTERS };
        collection.page = 1;
    }

    async function remove(bottle: AdminBottleDTO) {
        const name = bottleLabel(bottle);
        if (!(await confirm({ message: m['admin.confirm_delete_bottle']({ name }) }))) {
            return;
        }
        try {
            await collection.remove(bottle.id);
            toasts.add(m['toast.wine_bottle_deleted'](), 'success');
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        }
    }
</script>

<svelte:head>
    <title>{pageTitle(m['admin.wine_bottles'](), m['admin.title']())}</title>
</svelte:head>

<EntityListPanel
    {collection}
    title={m['admin.wine_bottles']()}
    searchPlaceholder={m['placeholders.search_bottles']()}
    onDelete={remove}
    onClearFilters={clearFilters}
>
    {#snippet filters()}
        <FilterSelect
            bind:value={filter.format}
            allLabel={m['admin.all_formats']()}
            options={data.formats.map((format) => ({ value: format.id, label: format.name }))}
            onchange={() => (collection.page = 1)}
        />
        <FilterSelect
            bind:value={filter.vintage}
            allLabel={m['common.all_vintages']()}
            options={vintages}
            onchange={() => (collection.page = 1)}
        />
        <FilterSelect
            bind:value={filter.availability}
            allLabel={m['admin.all_availability']()}
            options={Object.values(BottleAvailability).map((availability) => ({
                value: availability,
                label: availabilityLabel(availability)
            }))}
            onchange={() => (collection.page = 1)}
        />
    {/snippet}
    {#snippet entry(bottle)}
        <div class="flex flex-wrap items-center gap-2">
            {#if bottle.producer}<Badge variant="outline">{bottle.producer}</Badge>{/if}
            <span class="font-medium">{bottleLabel(bottle)}</span>
        </div>
        <p class="text-sm text-muted-foreground">
            {bottle.appellationName}, {bottle.regionName}, {bottle.countryName}
        </p>
        <p class="text-sm text-muted-foreground">
            {[bottle.formatName, availabilityLabel(bottle.availability), bottle.originName]
                .filter(Boolean)
                .join(' • ')}
        </p>
        <p class="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {#if bottle.barcode}
                <span
                    ><strong>{m['common.label']({ label: m['common.barcode']() })}</strong>
                    {bottle.barcode}</span
                >
            {/if}
            {#if bottle.storageCaseName}
                <span
                    ><strong>{m['common.label']({ label: m['common.location']() })}</strong>
                    {bottle.storageCaseName}</span
                >
            {/if}
        </p>
    {/snippet}
</EntityListPanel>
