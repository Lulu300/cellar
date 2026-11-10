<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { onMount, untrack } from 'svelte';
    import { Clock, List, MapPin, RotateCcw } from '@lucide/svelte';
    import { marksByCase } from '#lib/components/bottles/drinking.js';
    import { m } from '#lib/paraglide/messages.js';
    import AllBottlesDialog from '#lib/components/storage/AllBottlesDialog.svelte';
    import CaseBottlesDialog from '#lib/components/storage/CaseBottlesDialog.svelte';
    import ContainerDialog from '#lib/components/storage/ContainerDialog.svelte';
    import StorageGrid from '#lib/components/storage/StorageGrid.svelte';
    import StorageTable from '#lib/components/storage/StorageTable.svelte';
    import { ContainerDraft } from '#lib/components/storage/container-draft.svelte.js';
    import { utilization } from '#lib/components/storage/storage.js';
    import Pagination from '#lib/components/table/Pagination.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { formatPercent } from '#lib/utils/format.js';
    import { clampPage } from '#lib/utils/pagination.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // The server renders the defaults: the preferences of the browser apply once mounted.
    let viewMode = $state<'table' | 'grid'>('table');
    let containersAsColumns = $state(true);
    let showDrinking = $state(false);
    onMount(() => {
        viewMode = preferences.storageViewMode;
        containersAsColumns = preferences.containersAsColumns;
        showDrinking = preferences.showDrinkingMarker;
    });

    // The bottles to drink of each case within the horizon of the preferences, in this browser's
    // month, while the marker is shown.
    const horizon = $derived(showDrinking ? preferences.drinkingHorizon : undefined);
    const marks = $derived(
        horizon ? marksByCase(data.drinking, horizon) : new Map<string, never>()
    );

    const containersPerPage = 20;
    const containers = $derived(data.containers);

    // "Show in the cellar" on a wine page: the cases that hold the wine stand out.
    const highlight = $derived(data.highlight);
    const highlighted = $derived(new Set(highlight?.cases.map(({ id }) => id)));
    // The page opens on the first container that holds the wine, and stays where the user goes
    // when a change reloads the data. A writable derived resets on its dependencies only: it
    // reads the id of the wine, a string that a reload leaves equal, and untrack keeps the
    // containers, which every reload replaces, out of them.
    const highlightedWine = $derived(highlight?.id);
    let page = $derived.by(() => {
        void highlightedWine;
        return untrack(() => {
            const first = containers.findIndex(({ cases }) =>
                cases.some(({ id }) => highlighted.has(id))
            );
            return first === -1 ? 1 : Math.floor(first / containersPerPage) + 1;
        });
    });
    const shownPage = $derived(clampPage(page, containers.length, containersPerPage));
    const pageOfContainers = $derived(
        containers.slice((shownPage - 1) * containersPerPage, shownPage * containersPerPage)
    );

    const cases = $derived(containers.flatMap((container) => container.cases));
    const totalCapacity = $derived(cases.reduce((sum, { capacity }) => sum + capacity, 0));
    const totalBottles = $derived(cases.reduce((sum, { bottles }) => sum + bottles, 0));

    // The case whose bottles are open, as the reloaded data gives it: it goes when it is deleted.
    let openedCaseId = $state<string | null>(null);
    const openedCase = $derived(cases.find(({ id }) => id === openedCaseId));

    let draft = $state<ContainerDraft | null>(null);
    let showContainerDialog = $state(false);
    let showAllBottlesDialog = $state(false);

    function openContainerDialog(container: StorageContainerDTO | null) {
        draft = container ? ContainerDraft.edit(container) : ContainerDraft.create();
        showContainerDialog = true;
    }

    function addContainer() {
        if (auth.isAuthenticated) openContainerDialog(null);
        else toasts.add(m['storage.please_login_to_add_containers'](), 'warning');
    }

    const onEdit = $derived(auth.isAuthenticated ? openContainerDialog : undefined);
    const onOpen = ({ id }: { id: string }) => (openedCaseId = id);
</script>

<svelte:head>
    <title>{pageTitle(m['storage.title']())}</title>
    <meta name="description" content={m['storage.subtitle']()} />
</svelte:head>

<div class="flex flex-wrap justify-between items-center gap-4 mb-6">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">{m['storage.title']()}</h1>
        <p class="text-muted-foreground">{m['storage.subtitle']()}</p>
    </div>

    <div class="flex flex-wrap gap-2 items-center">
        <Button onclick={() => (showAllBottlesDialog = true)} variant="outline">
            <List class="h-4 w-4 mr-2" />
            {m['storage.view_all_bottles']()}
        </Button>

        <Button onclick={addContainer} variant={auth.isAuthenticated ? 'default' : 'outline'}>
            + {m['storage.add_container']()}
        </Button>

        <div class="flex gap-1 border rounded-md p-1">
            <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onclick={() => (viewMode = 'table')}
            >
                {m['common.table']()}
            </Button>
            <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onclick={() => (viewMode = 'grid')}
            >
                {m['common.grid']()}
            </Button>
        </div>

        <Button
            variant={showDrinking ? 'default' : 'outline'}
            aria-pressed={showDrinking}
            onclick={() => (showDrinking = !showDrinking)}
        >
            <Clock class="h-4 w-4 mr-2" aria-hidden="true" />
            {m['drinking.storage_toggle']()}
        </Button>

        {#if viewMode === 'table'}
            <Button variant="outline" onclick={() => (containersAsColumns = !containersAsColumns)}>
                <RotateCcw class="h-4 w-4 mr-2" />
                {containersAsColumns
                    ? m['storage.containers_as_rows']()
                    : m['storage.containers_as_columns']()}
            </Button>
        {/if}
    </div>
</div>

{#if highlight}
    <div
        class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2"
    >
        <MapPin class="h-4 w-4 shrink-0 text-primary-text" aria-hidden="true" />
        <p class="text-sm">
            {m['storage.cases_holding_wine']({
                wine: highlight.name,
                cases: highlight.cases.map(({ name }) => name).join(', ')
            })}
        </p>
        <Button
            variant="outline"
            size="sm"
            class="ml-auto"
            onclick={() => showTablePage({ wine: null })}
        >
            {m['common.show_all']()}
        </Button>
    </div>
{/if}

{#if containers.length === 0}
    <Card>
        <CardContent class="p-6 text-center">
            <p class="text-muted-foreground">{m['storage.no_storage_data']()}</p>
        </CardContent>
    </Card>
{:else}
    {#snippet pagination()}
        <Pagination
            page={shownPage}
            perPage={containersPerPage}
            total={containers.length}
            onPageChange={(next) => (page = next)}
        />
    {/snippet}

    {#if viewMode === 'grid'}
        <StorageGrid containers={pageOfContainers} {highlighted} {marks} {onOpen} {onEdit} />
        <div class="mt-6">{@render pagination()}</div>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>{m['storage.storage_overview']()}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="mb-4">{@render pagination()}</div>
                <StorageTable
                    containers={pageOfContainers}
                    {containersAsColumns}
                    {highlighted}
                    {marks}
                    {onOpen}
                    {onEdit}
                />
            </CardContent>
        </Card>
    {/if}

    <!-- Each card stops at 26rem: the cellar map makes this page as wide as the screen -->
    <div class="mt-6 grid grid-cols-1 md:grid-cols-[repeat(3,minmax(0,26rem))] gap-4">
        <Card>
            <CardContent class="p-6">
                <div class="text-2xl font-bold">{containers.length}</div>
                <div class="text-sm text-muted-foreground">
                    {m['common.storage_containers']()}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardContent class="p-6">
                <div class="text-2xl font-bold">{cases.length}</div>
                <div class="text-sm text-muted-foreground">{m['common.storage_cases']()}</div>
            </CardContent>
        </Card>

        <Card>
            <CardContent class="p-6">
                <div class="text-2xl font-bold">{totalBottles}/{totalCapacity}</div>
                <div class="text-sm text-muted-foreground">
                    {m['storage.bottles_full']({
                        percent: formatPercent(utilization(totalCapacity, totalBottles))
                    })}
                </div>
            </CardContent>
        </Card>
    </div>
{/if}

{#if draft}
    <ContainerDialog bind:open={showContainerDialog} {draft} />
{/if}

<AllBottlesDialog bind:open={showAllBottlesDialog} />

{#if openedCase}
    <CaseBottlesDialog
        storageCase={openedCase}
        drinkingHorizon={horizon}
        onClose={() => (openedCaseId = null)}
    />
{/if}
