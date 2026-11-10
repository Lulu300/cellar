<script lang="ts">
    import { onMount, type ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import { ArrowRightLeft, CalendarClock } from '@lucide/svelte';
    import { request } from '#lib/api/client.js';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import BottleChangeDialogs from '#lib/components/bottles/BottleChangeDialogs.svelte';
    import { BottleDialogs } from '#lib/components/bottles/bottle-dialogs.svelte.js';
    import BottleRowMenu from '#lib/components/bottles/BottleRowMenu.svelte';
    import BottleSelectionBar from '#lib/components/bottles/BottleSelectionBar.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { DrinkingHorizon } from '#lib/shared/drinking.js';
    import type { BottleWithDefinitionDTO, Jsonified } from '#lib/shared/dto.js';
    import { sortBottles, type BottleSort } from '#lib/utils/bottle-sort.js';

    type Bottle = Jsonified<BottleWithDefinitionDTO>;

    /**
     * The bottles that a case holds, to open, mark drunk, move or date, one or several at a time. The
     * storage page mounts it to open it, and unmounts it on `onClose`.
     */
    let {
        storageCase,
        drinkingHorizon,
        onClose
    }: {
        /** The case as the storage page shows it, which a change reloads. */
        storageCase: { id: string; name: string; capacity: number; bottles: number };
        /** While the page marks the bottles to drink, those within this horizon get a chip. */
        drinkingHorizon?: DrinkingHorizon;
        onClose: () => void;
    } = $props();

    let bottles = $state.raw<Bottle[]>([]);
    let loading = $state(true);
    let failed = $state(false);
    let sort = $state<BottleSort>({ column: 'definition', direction: 'asc' });
    const selected = new SvelteSet<string>();

    // A change of status or place changes the case and the map behind it.
    const dialogs = new BottleDialogs<Bottle>(selected, () =>
        Promise.all([load(), invalidate(CELLAR)])
    );
    let editingBottle = $state<ComponentProps<typeof WineBottleDialog>['editBottle']>(null);
    let showEditDialog = $state(false);

    const sortedBottles = $derived(sortBottles(bottles, sort));

    async function load() {
        try {
            bottles = await request<Bottle[]>(`/api/storage-cases/${storageCase.id}/bottles`);
            failed = false;
        } catch {
            failed = true;
        } finally {
            loading = false;
        }
    }
    onMount(load);

    function toggle(bottle: Bottle) {
        if (!selected.delete(bottle.id)) selected.add(bottle.id);
    }

    function toggleAll(select: boolean) {
        selected.clear();
        if (select) for (const { id } of bottles) selected.add(id);
    }

    const chosen = () => bottles.filter(({ id }) => selected.has(id));
</script>

{#snippet actions(bottle: Bottle)}
    <BottleRowMenu
        {bottle}
        {dialogs}
        onEdit={(bottle) => {
            editingBottle = bottle;
            showEditDialog = true;
        }}
    />
{/snippet}

<!-- Outside the scrolling list: the actions stay in view on a narrow screen. -->
{#snippet toolbar()}
    <BottleSelectionBar
        selection={selected}
        actions={[
            {
                label: m['drinking.window'](),
                icon: CalendarClock,
                run: () => (dialogs.dating = chosen())
            },
            {
                label: m['storage.move_to'](),
                icon: ArrowRightLeft,
                primary: true,
                run: () => (dialogs.moving = chosen())
            }
        ]}
    />
{/snippet}

<Dialog bind:open={() => true, (open) => !open && onClose()}>
    <ScrollingDialogContent
        title={storageCase.name}
        description={m['common.places_used']({
            used: storageCase.bottles,
            capacity: storageCase.capacity
        })}
        class="max-w-2xl sm:max-w-2xl"
        {toolbar}
    >
        {#if loading}
            <p class="text-center py-8 text-muted-foreground">{m['storage.loading_bottles']()}</p>
        {:else if failed}
            <p class="text-center py-8 text-destructive">{m['storage.failed_to_load_bottles']()}</p>
        {:else}
            <!-- The wine alone, which shows the vintage after the producer and, while the page
                 marks the bottles to drink, their chip: a column more would not fit a phone. -->
            <BottleTable
                bottles={sortedBottles}
                columns={['definition']}
                {drinkingHorizon}
                {sort}
                onSort={(next) => (sort = next)}
                emptyMessage={m['storage.case_empty']()}
                selection={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                {actions}
                linkWine
            />
        {/if}
    </ScrollingDialogContent>
</Dialog>

<BottleChangeDialogs {dialogs}>
    <!-- The bottle of a row's menu; several ticked ones are counted by the dialog itself. -->
    {#snippet children(chosen)}
        {#if chosen.length === 1}
            <p class="text-sm text-muted-foreground">{bottleName(chosen[0])}</p>
        {/if}
    {/snippet}
</BottleChangeDialogs>

<WineBottleDialog bind:open={showEditDialog} editBottle={editingBottle} onSaved={dialogs.saved} />
