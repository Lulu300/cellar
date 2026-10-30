<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { onMount } from 'svelte';
    import { List, RotateCcw } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import AllBottlesDialog from '#lib/components/storage/AllBottlesDialog.svelte';
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
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // The server renders the defaults: the preferences of the browser apply once mounted.
    let viewMode = $state<'table' | 'grid'>('table');
    let containersAsColumns = $state(true);
    onMount(() => {
        viewMode = preferences.storageViewMode;
        containersAsColumns = preferences.containersAsColumns;
    });

    const containersPerPage = 20;
    let page = $state(1);
    const containers = $derived(data.containers);
    const shownPage = $derived(clampPage(page, containers.length, containersPerPage));
    const pageOfContainers = $derived(
        containers.slice((shownPage - 1) * containersPerPage, shownPage * containersPerPage)
    );

    const cases = $derived(containers.flatMap((container) => container.cases));
    const totalCapacity = $derived(cases.reduce((sum, { capacity }) => sum + capacity, 0));
    const totalBottles = $derived(cases.reduce((sum, { bottles }) => sum + bottles, 0));

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
</script>

<svelte:head>
    <title>{pageTitle(m['storage.title']())}</title>
    <meta name="description" content={m['storage.subtitle']()} />
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
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

            {#if viewMode === 'table'}
                <Button
                    variant="outline"
                    onclick={() => (containersAsColumns = !containersAsColumns)}
                >
                    <RotateCcw class="h-4 w-4 mr-2" />
                    {containersAsColumns
                        ? m['storage.containers_as_rows']()
                        : m['storage.containers_as_columns']()}
                </Button>
            {/if}
        </div>
    </div>

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
            <StorageGrid containers={pageOfContainers} {onEdit} />
            <div class="mt-6">{@render pagination()}</div>
        {:else}
            <Card>
                <CardHeader>
                    <CardTitle>{m['storage.storage_overview']()}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="mb-4">{@render pagination()}</div>
                    <StorageTable containers={pageOfContainers} {containersAsColumns} {onEdit} />
                </CardContent>
            </Card>
        {/if}

        <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
</div>

{#if draft}
    <ContainerDialog bind:open={showContainerDialog} {draft} />
{/if}

<AllBottlesDialog bind:open={showAllBottlesDialog} />
