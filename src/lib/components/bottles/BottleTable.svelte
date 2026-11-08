<script lang="ts" generics="B extends TableBottle">
    import type { Snippet } from 'svelte';
    import { Pencil } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Checkbox } from '#lib/components/ui/checkbox/index.js';
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow
    } from '#lib/components/ui/table/index.js';
    import SortableHeader from '#lib/components/table/SortableHeader.svelte';
    import WineColorBadge from '#lib/components/wines/WineColorBadge.svelte';
    import AvailabilityBadge from './AvailabilityBadge.svelte';
    import DrinkingChip from './DrinkingChip.svelte';
    import { drinkBeforeText, drinkingText, markedRank } from './drinking.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import { DrinkingHorizon } from '#lib/shared/drinking.js';
    import { nextSort, type BottleColumn } from './bottle-table.js';
    import { drinkingDates, type BottleSort, type TableBottle } from '#lib/utils/bottle-sort.js';
    import { formatCurrency, formatDate } from '#lib/utils/format.js';

    /**
     * The bottles of out-of-cellar, the history, the bottles to drink and the bottle dialogs, or
     * rows of several bottles with their `count`. The parent sorts them: the table only says which
     * sort the user asked for.
     */
    let {
        bottles,
        columns,
        sort,
        onSort,
        emptyMessage,
        selection,
        onToggle,
        selectLabel,
        onToggleAll,
        onEdit,
        actions,
        linkWine = false,
        drinkingHorizon
    }: {
        bottles: B[];
        /** In their order; the notes, when to drink and the count cannot be sorted on. */
        columns: BottleColumn[];
        sort: BottleSort;
        onSort: (sort: BottleSort) => void;
        emptyMessage: string;
        /** With a selection, each row gets a checkbox. */
        selection?: { has(id: string): boolean };
        onToggle?: (bottle: B) => void;
        /** What a row's checkbox is called, when the row holds several bottles. */
        selectLabel?: (bottle: B) => string;
        /** Selects every bottle shown, or none of them. */
        onToggleAll?: (select: boolean) => void;
        /** With it, each row gets an edit button. */
        onEdit?: (bottle: B) => void;
        /** With it, what each row offers to do with its bottle, such as a menu. */
        actions?: Snippet<[B]>;
        /** Whether the name of the wine links to its page. */
        linkWine?: boolean;
        /**
         * The bottles whose « drinking » column gets a chip, those to drink soon without it. Given
         * without that column, the wine cell shows the chip.
         */
        drinkingHorizon?: DrinkingHorizon;
    } = $props();

    const labels = $derived({
        definition: m['common.wine'](),
        location: m['common.location'](),
        availability: m['bottle_table.status'](),
        vintage: m['common.vintage'](),
        format: m['common.format'](),
        purchaseDate: m['common.purchase_date'](),
        consumedDate: m['common.consumed_date'](),
        origin: m['common.origin'](),
        purchasePrice: m['common.price'](),
        barcode: m['common.barcode'](),
        notes: m['common.notes'](),
        drinking: m['drinking.column'](),
        urgency: m['drinking.urgency'](),
        optimum: m['drinking.optimum'](),
        drinkBefore: m['drinking.drink_before'](),
        color: m['common.color'](),
        count: m['common.bottles']()
    });
    const notAvailable = $derived(m['common.not_available']());
    const allSelected = $derived(
        bottles.length > 0 && bottles.every((bottle) => selection?.has(bottle.id))
    );
    const someSelected = $derived(bottles.some((bottle) => selection?.has(bottle.id)));
    const hasActions = $derived(!!onEdit || !!actions);
    const columnCount = $derived(columns.length + Number(!!selection) + Number(hasActions));
    // The wine cell shows the vintage and the colour when no column does.
    const vintageInWineCell = $derived(!columns.includes('vintage'));
    const colorInWineCell = $derived(!columns.includes('color'));
    // The chip of a bottle to drink, in the wine cell when no column shows it. Only a bottle in the
    // cellar is to drink, as on the banner and the map: one taken out or drunk keeps its date only.
    const chipInWineCell = $derived(!!drinkingHorizon && !columns.includes('drinking'));
    const rankOf = (bottle: B) =>
        bottle.availability === BottleAvailability.AVAILABLE
            ? markedRank(drinkingDates(bottle), drinkingHorizon ?? DrinkingHorizon.THIS_YEAR)
            : null;
</script>

<div class="rounded-md border">
    <Table>
        <TableHeader>
            <TableRow>
                {#if selection}
                    <TableHead class="w-12">
                        <!-- Bound through the selection: a box whose click selects nothing, as for
                             a visitor, stays as it was rather than ticked by the checkbox itself. -->
                        <Checkbox
                            bind:checked={() => allSelected, () => onToggleAll?.(!allSelected)}
                            bind:indeterminate={() => someSelected && !allSelected, () => {}}
                            aria-label={m['common.select_all']()}
                        />
                    </TableHead>
                {/if}
                {#each columns as column (column)}
                    {#if column === 'notes' || column === 'drinking' || column === 'count'}
                        <TableHead>{labels[column]}</TableHead>
                    {:else}
                        <SortableHeader
                            label={labels[column]}
                            direction={sort.column === column ? sort.direction : null}
                            onSort={() => onSort(nextSort(sort, column))}
                        />
                    {/if}
                {/each}
                {#if hasActions}
                    <TableHead class="w-16">{m['common.actions']()}</TableHead>
                {/if}
            </TableRow>
        </TableHeader>
        <TableBody>
            {#each bottles as bottle (bottle.id)}
                <TableRow class="hover:bg-muted/50 {selection?.has(bottle.id) ? 'bg-accent' : ''}">
                    {#if selection}
                        <TableCell>
                            <Checkbox
                                bind:checked={
                                    () => selection.has(bottle.id), () => onToggle?.(bottle)
                                }
                                aria-label={selectLabel?.(bottle) ??
                                    m['bottle_table.select_bottle']()}
                            />
                        </TableCell>
                    {/if}
                    {#each columns as column (column)}
                        {#if column === 'definition'}
                            <TableCell>
                                <div class="flex flex-col">
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        {#if linkWine && bottle.definition}
                                            <a
                                                href="/wines/{bottle.definition.id}"
                                                class="font-medium hover:underline hover:text-primary-text"
                                                title={m['wine_details.view_wine_page']()}
                                            >
                                                {bottle.definition.name}
                                            </a>
                                        {:else}
                                            <span class="font-medium">
                                                {bottle.definition?.name ?? notAvailable}
                                            </span>
                                        {/if}
                                        {#if colorInWineCell && bottle.definition}
                                            <WineColorBadge
                                                name={bottle.definition.color}
                                                hex={bottle.definition.colorHex}
                                            />
                                        {/if}
                                        {#if chipInWineCell}
                                            {@const rank = rankOf(bottle)}
                                            {#if rank}<DrinkingChip {rank} />{/if}
                                        {/if}
                                    </div>
                                    <span class="text-sm text-muted-foreground">
                                        {bottle.definition?.producer ?? ''}
                                        {vintageInWineCell ? (bottle.vintage ?? '') : ''}
                                    </span>
                                </div>
                            </TableCell>
                        {:else if column === 'location'}
                            <TableCell>{bottle.storageCase?.name ?? notAvailable}</TableCell>
                        {:else if column === 'availability'}
                            <TableCell>
                                <AvailabilityBadge availability={bottle.availability} />
                            </TableCell>
                        {:else if column === 'vintage'}
                            <TableCell>{bottle.vintage ?? notAvailable}</TableCell>
                        {:else if column === 'format'}
                            <TableCell>
                                <Badge variant="secondary">
                                    {bottle.format || m['bottle_table.standard']()}
                                </Badge>
                            </TableCell>
                        {:else if column === 'purchaseDate' || column === 'consumedDate'}
                            <TableCell>{formatDate(bottle[column])}</TableCell>
                        {:else if column === 'origin'}
                            <TableCell>{bottle.origin?.name ?? notAvailable}</TableCell>
                        {:else if column === 'purchasePrice'}
                            <TableCell>{formatCurrency(bottle.purchasePrice)}</TableCell>
                        {:else if column === 'barcode'}
                            <TableCell>{bottle.barcode || notAvailable}</TableCell>
                        {:else if column === 'drinking'}
                            {@const rank = rankOf(bottle)}
                            <TableCell>
                                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    {#if rank}<DrinkingChip {rank} />{/if}
                                    <span class="text-sm text-muted-foreground">
                                        {drinkingText(drinkingDates(bottle)) || '-'}
                                    </span>
                                </div>
                            </TableCell>
                        {:else if column === 'urgency'}
                            {@const rank = rankOf(bottle)}
                            <TableCell
                                >{#if rank}<DrinkingChip {rank} />{:else}-{/if}</TableCell
                            >
                        {:else if column === 'optimum'}
                            <TableCell>{bottle.optimum ?? '-'}</TableCell>
                        {:else if column === 'drinkBefore'}
                            <TableCell class="whitespace-nowrap">
                                {bottle.drinkBefore ? drinkBeforeText(bottle.drinkBefore) : '-'}
                            </TableCell>
                        {:else if column === 'color'}
                            <TableCell>
                                {#if bottle.definition}
                                    <WineColorBadge
                                        name={bottle.definition.color}
                                        hex={bottle.definition.colorHex}
                                    />
                                {/if}
                            </TableCell>
                        {:else if column === 'count'}
                            <TableCell>{bottle.count ?? 1}</TableCell>
                        {:else}
                            <TableCell class="max-w-xs truncate" title={bottle.notes ?? ''}>
                                {bottle.notes || '-'}
                            </TableCell>
                        {/if}
                    {/each}
                    {#if hasActions}
                        <TableCell>
                            {#if onEdit}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => onEdit(bottle)}
                                    title={m['common.edit']()}
                                    aria-label={m['common.edit']()}
                                >
                                    <Pencil class="h-4 w-4" />
                                </Button>
                            {/if}
                            {@render actions?.(bottle)}
                        </TableCell>
                    {/if}
                </TableRow>
            {:else}
                <TableRow>
                    <TableCell colspan={columnCount} class="text-center text-muted-foreground py-8">
                        {emptyMessage}
                    </TableCell>
                </TableRow>
            {/each}
        </TableBody>
    </Table>
</div>
