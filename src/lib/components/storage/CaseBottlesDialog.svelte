<script lang="ts">
    import { onMount, type ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import { ArrowRightLeft, EllipsisVertical, SquarePen, Wine } from '@lucide/svelte';
    import { request } from '#lib/api/client.js';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import BottleChangeDialogs from '#lib/components/bottles/BottleChangeDialogs.svelte';
    import { BottleDialogs, whenLoggedIn } from '#lib/components/bottles/bottle-dialogs.svelte.js';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { BottleWithDefinitionDTO, Jsonified } from '#lib/shared/dto.js';
    import { sortBottles, type BottleSort } from '#lib/utils/bottle-sort.js';

    type Bottle = Jsonified<BottleWithDefinitionDTO>;

    /**
     * The bottles that a case holds, to open, mark drunk or move, one or several at a time. The
     * storage page mounts it to open it, and unmounts it on `onClose`.
     */
    let {
        storageCase,
        onClose
    }: {
        /** The case as the storage page shows it, which a change reloads. */
        storageCase: { id: string; name: string; capacity: number; bottles: number };
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
    <DropdownMenu.Root>
        <DropdownMenu.Trigger
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={m['bottles.actions_for']({ name: bottleName(bottle) })}
            aria-label={m['bottles.actions_for']({ name: bottleName(bottle) })}
        >
            <EllipsisVertical class="h-4 w-4" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-auto outline-none">
            <DropdownMenu.Item onSelect={() => whenLoggedIn(() => (dialogs.status = [bottle]))}>
                <Wine aria-hidden="true" />
                {m['bottles.mark_drunk']()}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => whenLoggedIn(() => (dialogs.moving = [bottle]))}>
                <ArrowRightLeft aria-hidden="true" />
                {m['bottles.move']()}
            </DropdownMenu.Item>
            <DropdownMenu.Item
                onSelect={() =>
                    whenLoggedIn(() => {
                        editingBottle = bottle;
                        showEditDialog = true;
                    })}
            >
                <SquarePen aria-hidden="true" />
                {m['forms.edit_wine_bottle']()}
            </DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
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
            size="sm"
            class="ml-auto"
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
            <!-- The wine alone, which shows the vintage after the producer: a column more would
                 not fit a phone. -->
            <BottleTable
                bottles={sortedBottles}
                columns={['definition']}
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
    {#snippet children([bottle])}
        <p class="text-sm text-muted-foreground">{bottleName(bottle)}</p>
    {/snippet}
</BottleChangeDialogs>

<WineBottleDialog bind:open={showEditDialog} editBottle={editingBottle} onSaved={dialogs.saved} />
