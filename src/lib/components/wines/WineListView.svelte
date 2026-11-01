<script lang="ts">
    import { onMount } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/state';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import BottleDetailsDialog from '#lib/components/bottles/BottleDetailsDialog.svelte';
    import BarcodeSearch from '#lib/components/wines/BarcodeSearch.svelte';
    import WineCard from '#lib/components/wines/WineCard.svelte';
    import WineFilters from '#lib/components/wines/WineFilters.svelte';
    import WineListToolbar from '#lib/components/wines/WineListToolbar.svelte';
    import WineTable from '#lib/components/wines/WineTable.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { WineGroupDTO } from '#lib/shared/dto.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import {
        filterWines,
        readWineListQuery,
        wineListParams,
        type WineListQuery,
        type WineListView
    } from '#lib/utils/wine-filters.js';
    import { sortWineGroups } from '#lib/utils/wine-group-sort.js';

    type Wine = WineGroupDTO['definition'];

    let {
        wineList,
        imageUrls,
        onEditWine,
        onDuplicateWine,
        onAddBottle
    }: {
        /** The wines with their bottles still owned, from the load function. */
        wineList: WineGroupDTO[];
        /** The URL of each image by its id. */
        imageUrls: Map<string, string>;
        onEditWine: (wine: Wine) => void;
        onDuplicateWine: (wine: Wine) => void;
        onAddBottle: (wine: Wine) => void;
    } = $props();

    // The search, filters and sort live in the URL: coming back from a wine finds them, and a
    // link shares them.
    const query = $derived(readWineListQuery(page.url.searchParams));

    function changeQuery(changes: Partial<WineListQuery>) {
        showTablePage(wineListParams(changes));
    }

    const shownWines = $derived(
        sortWineGroups(filterWines(wineList, query), query.sort, query.dir)
    );
    const bottleCount = $derived(
        shownWines.reduce((total, wine) => total + wine.bottles.length, 0)
    );
    // Loaded by the root layout, for the menu too
    const outOfCellarCount: number = $derived(page.data.outOfCellarCount);

    // The preferences only set the first state: the switches do not change them. The server, which
    // cannot read them, renders the defaults.
    let showImages = $state(true);
    let preferredView = $state<WineListView>('cards');
    onMount(() => {
        showImages = preferences.showImages;
        preferredView = preferences.wineListView;
    });
    // A view chosen on the page stays in the URL, for the way back from a wine, a reload or a link.
    const view = $derived(query.view || preferredView);

    const imageUrl = (wine: Wine) => (wine.imageId ? imageUrls.get(wine.imageId) : undefined);

    // The code in the barcode field: it stays while the bottles that it found are shown.
    let barcode = $state('');

    // The wine whose bottles the dialog shows, and the bottle to select in it
    let detailsWine = $state.raw<Pick<Wine, 'id' | 'name' | 'producer'> | null>(null);
    let detailsBottleId = $state('');
    let showBottleDetails = $state(false);
    // Read from the list, so that the dialog shows the bottles as reloaded after a change
    const detailsBottles = $derived(
        wineList.find((wine) => wine.definition.id === detailsWine?.id)?.bottles ?? []
    );

    function openBottleDetails(wine: Pick<Wine, 'id' | 'name' | 'producer'>, bottleId = '') {
        detailsWine = wine;
        detailsBottleId = bottleId;
        showBottleDetails = true;
    }

    const reload = () => invalidate(CELLAR);
</script>

<div class="space-y-6">
    <Card>
        <CardHeader>
            <CardTitle>{m['common.filters']()}</CardTitle>
        </CardHeader>
        <CardContent class="relative">
            <WineFilters {query} onChange={changeQuery} />
            <BarcodeSearch
                wines={wineList}
                bind:code={barcode}
                onFound={(bottle) => openBottleDetails(bottle.definition, bottle.id)}
                onBottlesChanged={reload}
            />
            <WineListToolbar
                {query}
                onChange={changeQuery}
                wineCount={shownWines.length}
                {bottleCount}
                {outOfCellarCount}
                {view}
                bind:showImages
            />
        </CardContent>
    </Card>

    {#if shownWines.length === 0}
        <Card>
            <CardContent class="p-6 text-center">
                <p class="text-muted-foreground">
                    {m['wines.no_wines_found']()}
                </p>
            </CardContent>
        </Card>
    {:else if view === 'list'}
        <WineTable
            wines={shownWines}
            {imageUrl}
            {showImages}
            onEdit={onEditWine}
            onDuplicate={onDuplicateWine}
            {onAddBottle}
            onShowBottles={(wine) => openBottleDetails(wine)}
        />
    {:else}
        <!-- As many cards of 340 px or more as fit: the grid drops a column rather than squeeze them -->
        <div class="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
            {#each shownWines as { definition, bottles } (definition.id)}
                <WineCard
                    wine={definition}
                    {bottles}
                    imageUrl={imageUrl(definition)}
                    showImage={showImages}
                    onEdit={onEditWine}
                    onDuplicate={onDuplicateWine}
                    {onAddBottle}
                    onShowBottles={(wine) => openBottleDetails(wine)}
                />
            {/each}
        </div>
    {/if}
</div>

<BottleDetailsDialog
    bind:open={showBottleDetails}
    wineDefinition={detailsWine}
    bottles={detailsBottles}
    autoSelectBottleId={detailsBottleId}
    onBottlesChanged={reload}
    onClose={() => (barcode = '')}
/>
