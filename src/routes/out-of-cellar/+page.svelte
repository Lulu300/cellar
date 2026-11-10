<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { invalidate } from '$app/navigation';
    import { SvelteMap } from 'svelte/reactivity';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import BottleSelectionBar from '#lib/components/bottles/BottleSelectionBar.svelte';
    import BottleStatusDialog from '#lib/components/bottles/BottleStatusDialog.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import BackButton from '#lib/components/layout/BackButton.svelte';
    import PageSizeSelect from '#lib/components/table/PageSizeSelect.svelte';
    import Pagination from '#lib/components/table/Pagination.svelte';

    let { data } = $props();

    type Bottle = (typeof data.bottles)[number];

    // The load function sorts and pages the bottles from the query of the URL. The selection
    // keeps the bottles chosen on other pages, which the page no longer has.
    const selectedBottles = new SvelteMap<string, Bottle>();

    // The bottles whose status changes, while its dialog is open
    let statusBottles = $state.raw<Bottle[]>([]);

    function toggleBottleSelection(bottle: Bottle) {
        if (selectedBottles.has(bottle.id)) {
            selectedBottles.delete(bottle.id);
        } else {
            selectedBottles.set(bottle.id, bottle);
        }
    }

    function selectAllVisible(select: boolean) {
        for (const bottle of data.bottles) {
            if (select) selectedBottles.set(bottle.id, bottle);
            else selectedBottles.delete(bottle.id);
        }
    }

    async function afterStatusChange() {
        selectedBottles.clear();
        await invalidate(CELLAR);
    }

    // Deleted elsewhere: they leave the selection, and the page reloads without them.
    async function forgetDeletedBottles(ids: string[]) {
        for (const id of ids) selectedBottles.delete(id);
        statusBottles = statusBottles.filter((bottle) => !ids.includes(bottle.id));
        await invalidate(CELLAR);
    }
</script>

<svelte:head>
    <title>{pageTitle(m['common.out_of_cellar']())}</title>
    <meta name="description" content={m['out_of_cellar.subtitle']()} />
</svelte:head>

<div class="flex justify-between items-center mb-8">
    <div>
        <h1 class="text-3xl font-bold">{m['common.out_of_cellar']()}</h1>
        <p class="text-muted-foreground">{m['out_of_cellar.subtitle']()}</p>
    </div>

    <BackButton />
</div>

<div class="space-y-4">
    <p class="text-sm text-muted-foreground">
        {m['out_of_cellar.total_bottles_out']({ count: data.total })}
    </p>

    <BottleSelectionBar
        selection={selectedBottles}
        actions={[
            {
                label: m['out_of_cellar.change_availability_selected'](),
                primary: true,
                run: () => (statusBottles = [...selectedBottles.values()])
            }
        ]}
    />

    <PageSizeSelect perPage={data.perPage} />

    <BottleTable
        bottles={data.bottles}
        columns={[...data.columns, 'notes']}
        sort={{ column: data.sort, direction: data.direction }}
        onSort={({ column, direction }) =>
            showTablePage({ sort: column, dir: direction, page: null })}
        emptyMessage={m['out_of_cellar.no_bottles_out_of_cellar']()}
        selection={selectedBottles}
        onToggle={toggleBottleSelection}
        onToggleAll={selectAllVisible}
    />

    <Pagination
        page={data.page}
        perPage={data.perPage}
        total={data.total}
        onPageChange={(page) => showTablePage({ page })}
    />
</div>

{#if statusBottles.length > 0}
    <BottleStatusDialog
        bottles={statusBottles}
        onClose={() => (statusBottles = [])}
        onSaved={afterStatusChange}
        onMissing={forgetDeletedBottles}
    >
        <!-- They may come from several wines and pages: the dialog names them. -->
        {#if statusBottles.length > 1}
            <div class="max-h-32 overflow-y-auto border rounded-md p-2 bg-muted/30">
                <p class="text-xs text-muted-foreground mb-1">
                    {m['out_of_cellar.selected_bottles']()}
                </p>
                <ul class="text-sm space-y-1">
                    {#each statusBottles as bottle (bottle.id)}
                        <li class="truncate">• {bottleName(bottle)}</li>
                    {/each}
                </ul>
            </div>
        {:else}
            <p class="text-sm text-muted-foreground">{bottleName(statusBottles[0])}</p>
        {/if}
    </BottleStatusDialog>
{/if}
