<script lang="ts">
    import { BottleWine } from '@lucide/svelte';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import { formatNumber, formatPercent } from '#lib/utils/format.js';
    import { utilization, utilizationColor } from './storage.js';

    /**
     * A case with a bottle icon per place, filled for each bottle it holds, and how full it is. A
     * large case draws 24 places at most, 15 in the compact form of the grid, then the number of
     * the others: a case of 1,000 places would make a heavy page.
     */
    let {
        storageCase,
        compact = false
    }: { storageCase: StorageContainerDTO['cases'][number]; compact?: boolean } = $props();

    const COMPACT_PLACES = 15;
    const PLACES = 24;

    const { name, capacity, bottles } = $derived(storageCase);
    const percent = $derived(utilization(capacity, bottles));
    const places = $derived(Math.min(capacity, compact ? COMPACT_PLACES : PLACES));
</script>

{#snippet icons(size: string)}
    <!-- A filled place keeps the wine red of a bottle in every theme. -->
    {#each { length: places }, place (place)}
        <BottleWine
            class="{size} {place < bottles ? 'text-red-600' : 'text-muted-foreground/40'}"
            fill={place < bottles ? 'currentColor' : 'none'}
        />
    {/each}
{/snippet}

{#snippet more()}
    {#if capacity > places}
        <span class="text-xs text-muted-foreground ml-1">+{formatNumber(capacity - places)}</span>
    {/if}
{/snippet}

{#snippet badge()}
    <span class="px-1 py-0.5 rounded text-xs {utilizationColor(percent)}">
        {formatPercent(percent)}
    </span>
{/snippet}

{#if compact}
    <div class="border rounded-md p-2">
        <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-medium">{name}</span>
            <span class="text-xs text-muted-foreground">{bottles}/{capacity}</span>
        </div>
        <div class="flex flex-wrap gap-0.5">
            {@render icons('h-3 w-3')}
            {@render more()}
        </div>
        <div class="mt-1">{@render badge()}</div>
    </div>
{:else}
    <div class="space-y-2">
        <div class="text-xs font-medium">{name}</div>
        <div class="flex flex-wrap justify-center items-center gap-1">
            {@render icons('h-4 w-4')}
            {@render more()}
        </div>
        <div class="text-xs">
            <span class="font-medium">{bottles}/{capacity}</span>
            <span class="ml-1">{@render badge()}</span>
        </div>
    </div>
{/if}
