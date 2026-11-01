<script lang="ts" generics="B extends TableBottle">
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
    import AvailabilityBadge from './AvailabilityBadge.svelte';
    import { nextSort, type BottleColumn } from './bottle-table.js';
    import type { BottleSort, TableBottle } from '#lib/utils/bottle-sort.js';
    import { formatCurrency, formatDate } from '#lib/utils/format.js';

    /**
     * The bottles of out-of-cellar, the history and the bottle dialogs. The parent sorts them: the
     * table only says which sort the user asked for.
     */
    let {
        bottles,
        columns,
        sort,
        onSort,
        emptyMessage,
        selection,
        onToggle,
        onToggleAll,
        onEdit,
        linkWine = false
    }: {
        bottles: B[];
        /** In their order; only the notes cannot be sorted on. */
        columns: BottleColumn[];
        sort: BottleSort;
        onSort: (sort: BottleSort) => void;
        emptyMessage: string;
        /** With a selection, each row gets a checkbox. */
        selection?: { has(id: string): boolean };
        onToggle?: (bottle: B) => void;
        /** Selects every bottle shown, or none of them. */
        onToggleAll?: (select: boolean) => void;
        /** With it, each row gets an edit button. */
        onEdit?: (bottle: B) => void;
        /** Whether the name of the wine links to its page. */
        linkWine?: boolean;
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
        notes: m['common.notes']()
    });
    const notAvailable = $derived(m['common.not_available']());
    const allSelected = $derived(
        bottles.length > 0 && bottles.every((bottle) => selection?.has(bottle.id))
    );
    const someSelected = $derived(bottles.some((bottle) => selection?.has(bottle.id)));
    const columnCount = $derived(columns.length + Number(!!selection) + Number(!!onEdit));
    // The wine cell shows the vintage when no column does.
    const vintageInWineCell = $derived(!columns.includes('vintage'));
</script>

<div class="rounded-md border">
    <Table>
        <TableHeader>
            <TableRow>
                {#if selection}
                    <TableHead class="w-12">
                        <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onCheckedChange={() => onToggleAll?.(!allSelected)}
                            aria-label={m['common.select_all']()}
                        />
                    </TableHead>
                {/if}
                {#each columns as column (column)}
                    {#if column === 'notes'}
                        <TableHead>{labels.notes}</TableHead>
                    {:else}
                        <SortableHeader
                            label={labels[column]}
                            direction={sort.column === column ? sort.direction : null}
                            onSort={() => onSort(nextSort(sort, column))}
                        />
                    {/if}
                {/each}
                {#if onEdit}
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
                                checked={selection.has(bottle.id)}
                                onCheckedChange={() => onToggle?.(bottle)}
                                aria-label={m['bottle_table.select_bottle']()}
                            />
                        </TableCell>
                    {/if}
                    {#each columns as column (column)}
                        {#if column === 'definition'}
                            <TableCell>
                                <div class="flex flex-col">
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
                        {:else}
                            <TableCell class="max-w-xs truncate" title={bottle.notes ?? ''}>
                                {bottle.notes || '-'}
                            </TableCell>
                        {/if}
                    {/each}
                    {#if onEdit}
                        <TableCell>
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => onEdit(bottle)}
                                title={m['common.edit']()}
                                aria-label={m['common.edit']()}
                            >
                                <Pencil class="h-4 w-4" />
                            </Button>
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
