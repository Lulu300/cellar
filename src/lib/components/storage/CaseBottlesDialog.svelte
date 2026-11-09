<script lang="ts">
    import { onMount, type ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import { ArrowRightLeft, CalendarClock } from '@lucide/svelte';
    import { request } from '#lib/api/client.js';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import BottleChangeDialogs from '#lib/components/bottles/BottleChangeDialogs.svelte';
    import { BottleDialogs, whenLoggedIn } from '#lib/components/bottles/bottle-dialogs.svelte.js';
    import BottleRowMenu from '#lib/components/bottles/BottleRowMenu.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
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
        whenLoggedIn(() => {
            if (!selected.delete(bottle.id)) selected.add(bottle.id);
        });
    }

    function toggleAll(select: boolean) {
        whenLoggedIn(() => {
            selected.clear();
            if (select) for (const { id } of bottles) selected.add(id);
        });
    }
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

<!-- Outside the scrolling list, and wrapping: the move stays in view on a narrow screen. -->
{#snippet toolbar()}
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-primary-text">
            {m['admin.bottles_selected']({ count: selected.size })}
        </span>
        <Button variant="ghost" size="sm" onclick={() => selected.clear()}>
            {m['common.clear_selection']()}
        </Button>
        <Button
            variant="outline"
            size="sm"
            class="ml-auto"
            onclick={() => (dialogs.dating = bottles.filter(({ id }) => selected.has(id)))}
        >
            <CalendarClock class="h-4 w-4" aria-hidden="true" />
            {m['drinking.window']()}
        </Button>
        <Button
            size="sm"
            onclick={() => (dialogs.moving = bottles.filter(({ id }) => selected.has(id)))}
        >
            <ArrowRightLeft class="h-4 w-4" aria-hidden="true" />
            {m['storage.move_to']()}
        </Button>
    </div>
{/snippet}

<Dialog bind:open={() => true, (open) => !open && onClose()}>
    <ScrollingDialogContent
        title={storageCase.name}
        description={m['common.places_used']({
            used: storageCase.bottles,
            capacity: storageCase.capacity
        })}
        class="max-w-2xl sm:max-w-2xl"
        toolbar={selected.size > 0 ? toolbar : undefined}
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
