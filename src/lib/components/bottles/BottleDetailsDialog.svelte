<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { goto } from '$app/navigation';
    import { CalendarClock } from '@lucide/svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import { ownedBottles } from '#lib/utils/wine-group-sort.js';
    import { sortBottles, type BottleSort } from '#lib/utils/bottle-sort.js';
    import BottleChangeDialogs from '#lib/components/bottles/BottleChangeDialogs.svelte';
    import { BottleDialogs, whenLoggedIn } from '#lib/components/bottles/bottle-dialogs.svelte.js';
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

    const dialogs = new BottleDialogs<Bottle>(selectedBottles, () => onBottlesChanged());

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

    function editBottle(bottle: Bottle) {
        whenLoggedIn(() => {
            editingBottle = bottle;
            showEditBottleDialog = true;
        });
    }
</script>

<Dialog bind:open onOpenChange={(open) => !open && handleClose()}>
    <ScrollingDialogContent class="max-w-6xl sm:max-w-6xl">
        {#snippet title()}
            {#if wineDefinition}
                <button
                    type="button"
                    class="text-left hover:underline hover:text-primary-text transition-colors"
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
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => whenLoggedIn(() => (dialogs.dating = chosenBottles()))}
                        >
                            <CalendarClock class="h-4 w-4" aria-hidden="true" />
                            {m['drinking.window']()}
                        </Button>
                        {#if auth.isAuthenticated}
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() => (dialogs.moving = chosenBottles())}
                            >
                                {m['admin.change_storage_location']()}
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onclick={() => (dialogs.status = chosenBottles())}
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
                'drinking',
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

<BottleChangeDialogs {dialogs} />

<!-- Edit Bottle Dialog -->
<WineBottleDialog
    bind:open={showEditBottleDialog}
    editBottle={editingBottle}
    onSaved={() => onBottlesChanged()}
/>
