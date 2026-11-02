<script lang="ts">
    import { ArrowDown, ArrowUp } from '@lucide/svelte';
    import { TableHead } from '#lib/components/ui/table/index.js';
    import type { SortDirection } from '#lib/shared/schemas/bottle-list.js';
    import { quietButton } from '#lib/components/layout/button-states.js';

    /**
     * The header of a column that the table sorts on: a button, so that the keyboard reaches it,
     * and `aria-sort` on the column the table is sorted by.
     */
    let {
        label,
        direction,
        onSort
    }: {
        label: string;
        /** The direction of the table when it is sorted on this column, else null. */
        direction: SortDirection | null;
        onSort: () => void;
    } = $props();
</script>

<TableHead
    aria-sort={direction === null ? undefined : direction === 'asc' ? 'ascending' : 'descending'}
>
    <button
        type="button"
        class="-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 {quietButton}"
        onclick={onSort}
    >
        {label}
        {#if direction === 'asc'}
            <ArrowUp class="h-3.5 w-3.5" aria-hidden="true" />
        {:else if direction === 'desc'}
            <ArrowDown class="h-3.5 w-3.5" aria-hidden="true" />
        {/if}
    </button>
</TableHead>
