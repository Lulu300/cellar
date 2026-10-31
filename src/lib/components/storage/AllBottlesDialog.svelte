<script lang="ts">
    import { untrack, type ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import Pagination from '#lib/components/table/Pagination.svelte';
    import { clampPage } from '#lib/utils/pagination.js';
    import { compareText } from '#lib/utils/compare.js';
    import { sortBottles, type BottleSort } from '#lib/utils/bottle-sort.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { Jsonified, OwnedBottleDTO } from '#lib/shared/dto.js';

    type Bottle = Jsonified<OwnedBottleDTO>;

    /** The bottles still owned, to find and edit one. Loaded each time the dialog opens. */
    let { open = $bindable(false) }: { open?: boolean } = $props();

    let bottles = $state<Bottle[]>([]);
    let loading = $state(true);
    let failed = $state(false);

    let searchQuery = $state('');
    let barcodeFilter = $state<'all' | 'with' | 'without'>('all');
    /** A case id, or 'all', or 'none' for the bottles in no case. */
    let storageCaseFilter = $state('all');

    let sort = $state<BottleSort>({ column: 'purchaseDate', direction: 'desc' });
    let page = $state(1);
    const perPage = 50;

    let editingBottle = $state<ComponentProps<typeof WineBottleDialog>['editBottle']>(null);
    let showEditBottleDialog = $state(false);

    $effect(() => {
        if (open) untrack(loadBottles);
    });

    async function loadBottles() {
        loading = true;
        failed = false;
        try {
            const response = await fetch('/api/bottles/non-consumed');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bottles = await response.json();
        } catch {
            failed = true;
            bottles = [];
        } finally {
            loading = false;
        }
    }

    /** The cases that hold one of the bottles, for the case filter. */
    const storageCases = $derived(
        [
            ...new Map(
                bottles.flatMap(({ storageCase }) =>
                    storageCase ? [[storageCase.id, storageCase.name] as const] : []
                )
            )
        ]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => compareText(a.name, b.name))
    );

    const filteredBottles = $derived(
        bottles.filter((bottle) => {
            if (storageCaseFilter === 'none' && bottle.storageCase) return false;
            if (
                storageCaseFilter !== 'all' &&
                storageCaseFilter !== 'none' &&
                bottle.storageCase?.id !== storageCaseFilter
            ) {
                return false;
            }
            if (barcodeFilter === 'with' && !bottle.barcode) return false;
            if (barcodeFilter === 'without' && bottle.barcode) return false;
            const query = searchQuery.trim().toLowerCase();
            if (!query) return true;
            const { name, appellation } = bottle.definition;
            return [name, appellation].some((text) => text?.toLowerCase().includes(query));
        })
    );

    const sortedBottles = $derived(sortBottles(filteredBottles, sort));
    const shownPage = $derived(clampPage(page, sortedBottles.length, perPage));
    const pageOfBottles = $derived(
        sortedBottles.slice((shownPage - 1) * perPage, shownPage * perPage)
    );

    function editBottle(bottle: Bottle) {
        if (!auth.isAuthenticated) {
            toasts.add(m['toast.please_log_in_to_edit'](), 'warning');
            return;
        }
        // The list names the wine and the case of a bottle rather than giving their ids.
        editingBottle = {
            ...bottle,
            definitionId: bottle.definition.id,
            storageCaseId: bottle.storageCase?.id ?? null
        };
        showEditBottleDialog = true;
    }

    // The edit may move the bottle, or take it out of the cellar: the page behind shows how full
    // each case is.
    async function handleBottleEdited() {
        await Promise.all([loadBottles(), invalidate(CELLAR)]);
    }
</script>

<!-- Stretched, because a pagination sizes itself on its container (`@container`) and has no width
     of its own in the row of the footer. -->
{#snippet pagination()}
    <div class="w-full">
        <Pagination
            page={shownPage}
            {perPage}
            total={sortedBottles.length}
            onPageChange={(next) => (page = next)}
        />
    </div>
{/snippet}

<Dialog bind:open>
    <!-- The pagination stays in view under the list, which scrolls. Passed only when there is more
         than one page, as the footer would otherwise draw its border above nothing. -->
    <ScrollingDialogContent
        title={m['common.all_bottles']()}
        class="max-w-6xl sm:max-w-6xl"
        footer={!loading && !failed && sortedBottles.length > perPage ? pagination : undefined}
    >
        <!-- Filters -->
        <div class="mb-4 space-y-4">
            <div class="flex gap-4 items-end flex-wrap">
                <!-- Search input -->
                <div class="flex-1 min-w-[200px]">
                    <Label for="search-wine">{m['storage.search_wine_name']()}</Label>
                    <Input
                        id="search-wine"
                        type="text"
                        placeholder={m['storage.search_placeholder']()}
                        bind:value={searchQuery}
                        oninput={() => (page = 1)}
                        class="w-full"
                    />
                </div>

                <!-- Barcode filter -->
                <div class="flex items-center gap-2">
                    <Label for="barcode-filter" class="text-sm font-medium"
                        >{m['storage.barcode_filter']()}</Label
                    >
                    <Select.Root
                        type="single"
                        bind:value={barcodeFilter}
                        onValueChange={() => (page = 1)}
                    >
                        <Select.Trigger id="barcode-filter" class="w-[200px]">
                            {#if barcodeFilter === 'all'}
                                {m['storage.all_bottles']()}
                            {:else if barcodeFilter === 'with'}
                                {m['storage.with_barcode']()}
                            {:else if barcodeFilter === 'without'}
                                {m['storage.without_barcode']()}
                            {/if}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all" label={m['storage.all_bottles']()}
                                >{m['storage.all_bottles']()}</Select.Item
                            >
                            <Select.Item value="with" label={m['storage.with_barcode']()}
                                >{m['storage.with_barcode']()}</Select.Item
                            >
                            <Select.Item value="without" label={m['storage.without_barcode']()}
                                >{m['storage.without_barcode']()}</Select.Item
                            >
                        </Select.Content>
                    </Select.Root>
                </div>

                <!-- Storage case filter -->
                <div class="flex items-center gap-2">
                    <Label for="case-filter" class="text-sm font-medium"
                        >{m['common.label']({
                            label: m['storage.storage_case_filter']()
                        })}</Label
                    >
                    <Select.Root
                        type="single"
                        bind:value={storageCaseFilter}
                        onValueChange={() => (page = 1)}
                    >
                        <Select.Trigger id="case-filter" class="w-[200px]">
                            {#if storageCaseFilter === 'all'}
                                {m['storage.all_cases']()}
                            {:else if storageCaseFilter === 'none'}
                                {m['storage.no_storage_case']()}
                            {:else}
                                {storageCases.find((c) => c.id === storageCaseFilter)?.name ||
                                    m['storage.all_cases']()}
                            {/if}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all" label={m['storage.all_cases']()}
                                >{m['storage.all_cases']()}</Select.Item
                            >
                            <Select.Item value="none" label={m['storage.no_storage_case']()}
                                >{m['storage.no_storage_case']()}</Select.Item
                            >
                            {#each storageCases as storageCase (storageCase.id)}
                                <Select.Item value={storageCase.id} label={storageCase.name}>
                                    {storageCase.name}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>

            <p class="text-sm text-muted-foreground">
                {m['admin.showing_bottles']({ count: sortedBottles.length })}
            </p>
        </div>

        {#if loading}
            <div class="text-center py-8">
                <p class="text-muted-foreground">{m['storage.loading_bottles']()}</p>
            </div>
        {:else if failed}
            <div class="text-center py-8">
                <p class="text-destructive">{m['storage.failed_to_load_bottles']()}</p>
            </div>
        {:else}
            <BottleTable
                bottles={pageOfBottles}
                columns={[
                    'definition',
                    'location',
                    'availability',
                    'vintage',
                    'format',
                    'purchaseDate',
                    'origin',
                    'purchasePrice',
                    'barcode',
                    'notes'
                ]}
                {sort}
                onSort={(next) => (sort = next)}
                emptyMessage={m['storage.no_bottles_found']()}
                onEdit={editBottle}
                linkWine
            />
        {/if}
    </ScrollingDialogContent>
</Dialog>

<!-- Edit Bottle Dialog -->
<WineBottleDialog
    bind:open={showEditBottleDialog}
    editBottle={editingBottle}
    onSaved={handleBottleEdited}
/>
