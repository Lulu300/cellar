<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/state';
    import { SvelteSet } from 'svelte/reactivity';
    import { ArrowRightLeft, CalendarClock } from '@lucide/svelte';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import { BottleDialogs } from '#lib/components/bottles/bottle-dialogs.svelte.js';
    import BottleChangeDialogs from '#lib/components/bottles/BottleChangeDialogs.svelte';
    import BottleRowMenu from '#lib/components/bottles/BottleRowMenu.svelte';
    import BottleSelectionBar from '#lib/components/bottles/BottleSelectionBar.svelte';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import DrinkingMark from '#lib/components/bottles/DrinkingMark.svelte';
    import { countedLabel } from '#lib/components/bottles/drinking.js';
    import {
        filterChoices,
        filterToDrink,
        groupByWine,
        readToDrinkQuery,
        shownFilters,
        TO_DRINK_COLUMNS,
        toDrinkParams,
        WINE_ROW_COLUMNS
    } from '#lib/components/bottles/to-drink.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import ToggleChip from '#lib/components/forms/ToggleChip.svelte';
    import BackButton from '#lib/components/layout/BackButton.svelte';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import ChoiceButtons from '#lib/components/preferences/ChoiceButtons.svelte';
    import PageSizeSelect from '#lib/components/table/PageSizeSelect.svelte';
    import Pagination from '#lib/components/table/Pagination.svelte';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import DebouncedInput from '#lib/components/wines/DebouncedInput.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { DrinkingRank } from '#lib/shared/drinking.js';
    import { sortBottles } from '#lib/utils/bottle-sort.js';
    import { clampPage } from '#lib/utils/pagination.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import { wineColorStyle } from '#lib/utils/wine-color.js';

    let { data } = $props();

    type Bottle = (typeof data.bottles)[number];

    // The view, filters, sort and page live in the URL: a reload or the way back finds them.
    const query = $derived(readToDrinkQuery(page.url.searchParams));

    /** Shows the first page with a new view or filter. */
    function change(changes: Parameters<typeof toDrinkParams>[0]) {
        showTablePage({ ...toDrinkParams(changes), page: null });
    }

    const filters = $derived(shownFilters(data.bottles, query));
    const shown = $derived(filterToDrink(data.bottles, filters));
    const choices = $derived(filterChoices(data.bottles, filters));
    const colors = $derived(
        new Map(data.bottles.map(({ definition }) => [definition.colorId, definition]))
    );
    const sort = $derived({ column: query.sort, direction: query.direction });
    const wineRows = $derived(sortBottles(groupByWine(shown), sort));
    const bottleRows = $derived(sortBottles(shown, sort));
    const rowCount = $derived(query.view === 'wine' ? wineRows.length : bottleRows.length);
    const shownPage = $derived(clampPage(query.page, rowCount, query.perPage));
    const pageSlice = <T,>(rows: T[]) =>
        rows.slice((shownPage - 1) * query.perPage, shownPage * query.perPage);

    // The selection holds bottles, whatever the view, the filters and the page.
    const selected = new SvelteSet<string>();
    const dialogs = new BottleDialogs<Bottle>(selected, () => invalidate(CELLAR));
    let editingBottle = $state<ComponentProps<typeof WineBottleDialog>['editBottle']>(null);
    let showEditDialog = $state(false);

    const chosen = () => data.bottles.filter(({ id }) => selected.has(id));

    /** Ticks or unticks these bottles. */
    function select(bottles: Bottle[], on: boolean) {
        for (const { id } of bottles) {
            if (on) selected.add(id);
            else selected.delete(id);
        }
    }

    /** A row's checkbox: it ticks its bottles, or unticks them once all are ticked. */
    const toggle = (bottles: Bottle[]) =>
        select(bottles, !bottles.every(({ id }) => selected.has(id)));

    // A row of the view by wine is ticked when all its bottles are.
    const wineSelection = {
        has: (id: string) =>
            wineRows.find((row) => row.id === id)?.bottles.every((b) => selected.has(b.id)) ?? false
    };

    const views = $derived([
        { value: 'bottle' as const, label: m['drinking.by_bottle']() },
        { value: 'wine' as const, label: m['drinking.by_wine']() }
    ]);

    const rankChoice = (rank: DrinkingRank) => () =>
        change({ rank: filters.rank === rank ? '' : rank });
</script>

<svelte:head>
    <title>{pageTitle(m['drinking.column']())}</title>
    <meta name="description" content={m['drinking.page_subtitle']()} />
</svelte:head>

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

<div class="flex flex-wrap justify-between items-center gap-4 mb-8">
    <div>
        <h1 class="text-3xl font-bold">{m['drinking.column']()}</h1>
        <p class="text-muted-foreground">{m['drinking.page_subtitle']()}</p>
    </div>
    <BackButton />
</div>

<div class="space-y-4">
    <Card class="py-4">
        <CardContent class="space-y-3 px-4">
            <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div class="w-full space-y-2 sm:w-72">
                    <Label for="to-drink-search">{m['wines.search']()}</Label>
                    <DebouncedInput
                        id="to-drink-search"
                        value={query.search}
                        onChange={(search) => change({ search })}
                        placeholder={m['storage.search_placeholder']()}
                    />
                </div>
                <ChoiceButtons
                    aria-label={m['wines.view']()}
                    class="p-0.5"
                    buttonClass="h-7"
                    options={views}
                    value={query.view}
                    onchange={(view) => change({ view })}
                />
            </div>
            <div
                class="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-labelledby="to-drink-ranks"
            >
                <span id="to-drink-ranks" class="mr-1 w-20 text-sm text-muted-foreground">
                    {m['drinking.urgency']()}
                </span>
                {#each choices.ranks as { value: rank, count } (rank)}
                    <ToggleChip pressed={filters.rank === rank} onclick={rankChoice(rank)}>
                        <DrinkingMark {rank} size={10} />
                        {countedLabel(rank, count)}
                    </ToggleChip>
                {/each}
            </div>
            <div
                class="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-labelledby="to-drink-colors"
            >
                <span id="to-drink-colors" class="mr-1 w-20 text-sm text-muted-foreground">
                    {m['common.color']()}
                </span>
                {#each choices.colors as { value: color, count } (color)}
                    {@const wine = colors.get(color)!}
                    <ToggleChip
                        pressed={filters.color === color}
                        onclick={() => change({ color: filters.color === color ? '' : color })}
                    >
                        <span
                            class="wine-color size-3 rounded-full border border-(--wine-edge) bg-(--wine)"
                            style={wineColorStyle(wine.colorHex)}
                            aria-hidden="true"
                        ></span>
                        {wine.color}
                        <span class="text-muted-foreground">{count}</span>
                    </ToggleChip>
                {/each}
            </div>
        </CardContent>
    </Card>

    <div class="flex flex-wrap items-center justify-between gap-2">
        <!-- Named after the rows of the view: the wines, or the bottles -->
        <p class="text-sm text-muted-foreground">
            {query.view === 'wine'
                ? m['wines.summary']({ wines: wineRows.length, bottles: shown.length })
                : m['drinking.bottles_of_wines']({
                      bottles: shown.length,
                      wines: wineRows.length
                  })}
        </p>
        <PageSizeSelect perPage={query.perPage} />
    </div>

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
                run: () => (dialogs.moving = chosen())
            },
            {
                label: m['admin.change_bottle_availability'](),
                primary: true,
                run: () => (dialogs.status = chosen())
            }
        ]}
    />

    {#if query.view === 'wine'}
        <BottleTable
            bottles={pageSlice(wineRows)}
            columns={[...WINE_ROW_COLUMNS]}
            {sort}
            onSort={({ column, direction }) =>
                showTablePage({ sort: column, dir: direction, page: null })}
            emptyMessage={m['storage.no_bottles_found']()}
            selection={wineSelection}
            selectLabel={(row) => m['drinking.select_bottles']({ count: row.count })}
            onToggle={(row) => toggle(row.bottles)}
            onToggleAll={(on) =>
                select(
                    pageSlice(wineRows).flatMap((row) => row.bottles),
                    on
                )}
            linkWine
        />
    {:else}
        <BottleTable
            bottles={pageSlice(bottleRows)}
            columns={[...TO_DRINK_COLUMNS]}
            {sort}
            onSort={({ column, direction }) =>
                showTablePage({ sort: column, dir: direction, page: null })}
            emptyMessage={m['storage.no_bottles_found']()}
            selection={selected}
            onToggle={(bottle) => toggle([bottle])}
            onToggleAll={(on) => select(pageSlice(bottleRows), on)}
            {actions}
            linkWine
        />
    {/if}

    <Pagination
        page={shownPage}
        perPage={query.perPage}
        total={rowCount}
        onPageChange={(page) => showTablePage({ page })}
    />
</div>

<BottleChangeDialogs {dialogs}>
    {#snippet children(chosen)}
        {#if chosen.length === 1}
            <p class="text-sm text-muted-foreground">{bottleName(chosen[0])}</p>
        {/if}
    {/snippet}
</BottleChangeDialogs>

<WineBottleDialog bind:open={showEditDialog} editBottle={editingBottle} onSaved={dialogs.saved} />
