<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { goto } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import { ownedBottles } from '#lib/utils/wine-group-sort.js';
    import { sortBottles, type BottleSort } from '#lib/utils/bottle-sort.js';
    import BottleStatusDialog from '#lib/components/bottles/BottleStatusDialog.svelte';
    import MoveBottlesDialog from '#lib/components/bottles/MoveBottlesDialog.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { DefinitionDTO, ListedBottleDTO } from '#lib/shared/dto.js';

    type Bottle = ListedBottleDTO;

    let {
        open = $bindable(false),
        wineDefinition = null,
        bottles = [],
        autoSelectBottleId = '',
        onBottlesChanged,
        onClose
    }: {
        open?: boolean;
        wineDefinition?: Pick<DefinitionDTO, 'id' | 'name' | 'producer'> | null;
        bottles?: Bottle[];
        /** The bottle to select when the dialog opens, such as the one a barcode found. */
        autoSelectBottleId?: string;
        /** Called after a change to the bottles, for the parent to reload them. */
        onBottlesChanged: () => Promise<void> | void;
        onClose: () => void;
    } = $props();

    const selectedBottles = new SvelteSet<string>();
    let sort = $state<BottleSort>({ column: 'purchaseDate', direction: 'desc' });

    // The bottles that change status, or move, while their dialog is open
    let statusBottles = $state.raw<Bottle[]>([]);
    let movingBottles = $state.raw<Bottle[]>([]);

    // Edit bottle dialog state
    let editingBottle = $state<ComponentProps<typeof WineBottleDialog>['editBottle']>(null);
    let showEditBottleDialog = $state(false);

    $effect(() => {
        if (autoSelectBottleId && open) {
            selectedBottles.clear();
            selectedBottles.add(autoSelectBottleId);
        }
    });

    const sortedBottles = $derived(sortBottles(ownedBottles(bottles), sort));

    function toggleBottleSelection(bottle: Bottle) {
        if (!selectedBottles.delete(bottle.id)) selectedBottles.add(bottle.id);
    }

    function selectAll(select: boolean) {
        selectedBottles.clear();
        if (select) sortedBottles.forEach((bottle) => selectedBottles.add(bottle.id));
    }

    function handleClose() {
        selectedBottles.clear();
        onClose();
        open = false;
    }

    function goToWinePage() {
        if (wineDefinition?.id) {
            handleClose();
            goto(`/wines/${wineDefinition.id}`);
        }
    }

    function chosenBottles() {
        return sortedBottles.filter((bottle) => selectedBottles.has(bottle.id));
    }

    async function afterChange() {
        selectedBottles.clear();
        await onBottlesChanged();
    }

    /**
     * Leaves out of the selection the bottles deleted elsewhere, which a refused change names, and
     * has the parent reload the list without them, so that trying again can work.
     */
    async function forgetDeletedBottles(ids: string[]) {
        const kept = (bottle: Bottle) => !ids.includes(bottle.id);
        statusBottles = statusBottles.filter(kept);
        movingBottles = movingBottles.filter(kept);
        ids.forEach((id) => selectedBottles.delete(id));
        await onBottlesChanged();
    }

    function editBottle(bottle: Bottle) {
        if (auth.isAuthenticated) {
            editingBottle = bottle;
            showEditBottleDialog = true;
        } else toasts.add(m['toast.please_log_in_to_edit'](), 'warning');
    }
</script>

<Dialog bind:open onOpenChange={(open) => !open && handleClose()}>
    <ScrollingDialogContent class="max-w-6xl sm:max-w-6xl">
        {#snippet title()}
            {#if wineDefinition}
                <button
                    type="button"
                    class="text-left hover:underline hover:text-primary-text cursor-pointer transition-colors"
                    onclick={goToWinePage}
                    title={m['wine_details.view_wine_page']()}
                >
                    {wineDefinition.name} - {wineDefinition.producer}
                </button>
            {/if}
        {/snippet}

        <!-- Outside the scrolling table, and wrapping: the actions stay in view on a narrow screen. -->
        {#snippet toolbar()}
            <div class="flex flex-wrap justify-between items-center gap-2">
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p class="text-sm text-muted-foreground">
                        {m['admin.showing_bottles']({ count: sortedBottles.length })}
                    </p>
                    {#if selectedBottles.size > 0}
                        <span class="text-sm font-medium text-primary-text">
                            {m['admin.bottles_selected']({ count: selectedBottles.size })}
                        </span>
                        <Button variant="ghost" size="sm" onclick={() => selectedBottles.clear()}>
                            {m['common.clear_selection']()}
                        </Button>
                    {/if}
                </div>
                {#if selectedBottles.size > 0}
                    <div class="flex flex-wrap gap-2">
                        {#if auth.isAuthenticated}
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() => (movingBottles = chosenBottles())}
                            >
                                {m['admin.change_storage_location']()}
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onclick={() => (statusBottles = chosenBottles())}
                            >
                                {m['admin.change_bottle_availability']()}
                            </Button>
                        {:else}
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() =>
                                    toasts.add(
                                        m['bottles.log_in_to_change_availability'](),
                                        'warning'
                                    )}
                            >
                                {m['admin.change_storage_location']()}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() =>
                                    toasts.add(
                                        m['bottles.log_in_to_change_availability'](),
                                        'warning'
                                    )}
                            >
                                {m['admin.change_bottle_availability']()}
                            </Button>
                        {/if}
                    </div>
                {/if}
            </div>
        {/snippet}

        <BottleTable
            bottles={sortedBottles}
            columns={[
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
            emptyMessage={m['wine_details.no_available_bottles']()}
            selection={selectedBottles}
            onToggle={toggleBottleSelection}
            onToggleAll={selectAll}
            onEdit={editBottle}
        />
    </ScrollingDialogContent>
</Dialog>

{#if statusBottles.length > 0}
    <BottleStatusDialog
        bottles={statusBottles}
        onClose={() => (statusBottles = [])}
        onSaved={afterChange}
        onMissing={forgetDeletedBottles}
    />
{/if}

{#if movingBottles.length > 0}
    <MoveBottlesDialog
        bottles={movingBottles}
        onClose={() => (movingBottles = [])}
        onSaved={afterChange}
        onMissing={forgetDeletedBottles}
    />
{/if}

<!-- Edit Bottle Dialog -->
<WineBottleDialog
    bind:open={showEditBottleDialog}
    editBottle={editingBottle}
    onSaved={() => onBottlesChanged()}
/>
