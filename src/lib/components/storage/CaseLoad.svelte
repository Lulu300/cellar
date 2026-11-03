<script lang="ts">
    import { MapPin } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { StorageContainerDTO } from '#lib/shared/dto.js';
    import { formatNumber, formatPercent } from '#lib/utils/format.js';
    import { wineColorStyle } from '#lib/utils/wine-color.js';
    import { utilization, utilizationColor } from './storage.js';
    import { chosenTile, quietButton } from '#lib/components/layout/button-states.js';
    import { marksName, type CaseMarks } from '#lib/components/bottles/drinking.js';
    import DrinkingMark from '#lib/components/bottles/DrinkingMark.svelte';

    /**
     * A case with a bottle icon per place, filled for each bottle it holds, and how full it is: a
     * button that opens its bottles. A large case draws 24 places at most, 15 in the compact form
     * of the grid, then the number of the others: a case of 1,000 places would make a heavy page.
     * With `marks`, a badge for each rank of its bottles to drink, with their number.
     */
    let {
        storageCase,
        compact = false,
        highlighted = false,
        marks = [],
        onOpen
    }: {
        storageCase: StorageContainerDTO['cases'][number];
        compact?: boolean;
        /** Whether it holds the wine that the page looks for. */
        highlighted?: boolean;
        /** How many of its bottles to drink it holds, by rank, while the page shows them. */
        marks?: CaseMarks;
        onOpen: () => void;
    } = $props();

    const COMPACT_PLACES = 15;
    const PLACES = 24;

    const { name, capacity, bottles } = $derived(storageCase);
    const percent = $derived(utilization(capacity, bottles));
    const places = $derived(Math.min(capacity, compact ? COMPACT_PLACES : PLACES));
</script>

{#snippet icons(size: string)}
    <!-- A plain bottle per place, without the label lines of an icon, which an edge would draw
         unevenly: a filled place takes the colour of its bottle's wine, edged in the same hue
         (wine-color.ts); an empty place is a faint outline. -->
    {#each { length: places }, place (place)}
        {@const hex = storageCase.colors[place]}
        <svg
            viewBox="0 0 24 24"
            class={[
                size,
                hex ? 'wine-color fill-(--wine) text-(--wine-edge)' : 'text-muted-foreground/40'
            ]}
            style={hex ? wineColorStyle(hex) : undefined}
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path
                d="M10 2h4v4.5c0 1 3 2 3 5.5v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9c0-3.5 3-4.5 3-5.5z"
            />
        </svg>
    {/each}
{/snippet}

{#snippet more()}
    {#if capacity > places}
        <span class="text-xs text-muted-foreground ml-1">+{formatNumber(capacity - places)}</span>
    {/if}
{/snippet}

{#snippet title()}
    {#if highlighted}
        <MapPin class="inline h-3.5 w-3.5 text-primary-text" aria-hidden="true" />
    {/if}
    {name}
{/snippet}

<!-- The shapes and numbers are drawn only: the name of the button says them. -->
{#snippet drinking()}
    {#if marks.length > 0}
        <span class="flex flex-wrap justify-center gap-1" aria-hidden="true">
            {#each marks as { rank, count } (rank)}
                <span
                    class="inline-flex items-center gap-0.5 rounded-full border bg-card px-1.5 text-xs font-medium leading-4"
                >
                    <DrinkingMark {rank} size={9} />
                    {count}
                </span>
            {/each}
        </span>
    {/if}
{/snippet}

{#snippet badge()}
    <span class="px-1 py-0.5 rounded text-xs {utilizationColor(percent)}">
        {formatPercent(percent)}
    </span>
{/snippet}

<!-- The name tells a screen reader what the drawing shows. -->
<button
    type="button"
    class={[
        'w-full rounded-md text-left',
        compact ? 'border p-2' : 'p-1 text-center',
        highlighted
            ? `ring-2 ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${chosenTile}`
            : quietButton
    ]}
    aria-label={[
        highlighted
            ? m['storage.open_case_holding_wine']({ name, bottles, capacity })
            : m['storage.open_case']({ name, bottles, capacity }),
        ...(marks.length > 0 ? [marksName(marks)] : [])
    ].join('. ')}
    onclick={onOpen}
>
    {#if compact}
        <div class="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-1">
            <span class="text-sm font-medium">{@render title()}</span>
            {@render drinking()}
            <span class="text-xs text-muted-foreground">{bottles}/{capacity}</span>
        </div>
        <div class="flex flex-wrap gap-0.5">
            {@render icons('h-3 w-3')}
            {@render more()}
        </div>
        <div class="mt-1">{@render badge()}</div>
    {:else}
        <div class="space-y-2">
            <div class="text-xs font-medium">{@render title()}</div>
            {@render drinking()}
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
</button>
