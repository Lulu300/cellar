<script lang="ts">
    import type { DrinkingRank } from '#lib/shared/drinking.js';
    import { cn } from '#lib/utils.js';
    import { RANK_TEXT } from './drinking.js';

    /**
     * How soon to drink a bottle, as a shape that tells it without its colour, the same wherever a
     * rank shows: late a triangle (a warning), this month a filled disc, this year a hollow ring,
     * optimum reached a diamond, later a short dash. Drawn on a 12-unit grid, so that every shape
     * keeps its weight at any `size`; its colour (RANK_TEXT) only doubles it. Decorative: the rank
     * is always said in text beside it.
     */
    let {
        rank,
        size = 12,
        class: className
    }: {
        rank: DrinkingRank;
        /** Its width and height, in CSS pixels. */
        size?: number;
        class?: string;
    } = $props();
</script>

<svg
    viewBox="0 0 12 12"
    width={size}
    height={size}
    class={cn('inline-block shrink-0', RANK_TEXT[rank], className)}
    aria-hidden="true"
>
    {#if rank === 'late'}
        <path d="M6 0.6 11.6 11H0.4Z" fill="currentColor" stroke-linejoin="round" />
    {:else if rank === 'this_month'}
        <circle cx="6" cy="6" r="5.2" fill="currentColor" />
    {:else if rank === 'this_year'}
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
    {:else if rank === 'optimum_reached'}
        <path d="M6 0.2 11.8 6 6 11.8 0.2 6Z" fill="currentColor" stroke-linejoin="round" />
    {:else}
        <rect x="1" y="4.6" width="10" height="2.8" rx="1" fill="currentColor" />
    {/if}
</svg>
