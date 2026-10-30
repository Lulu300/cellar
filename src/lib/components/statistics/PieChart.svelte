<script lang="ts">
    import { PIE_CENTER, PIE_RADIUS, pieSlices } from '#lib/utils/pie-chart.js';

    let { slices }: { slices: { count: number; color: string }[] } = $props();

    const shapes = $derived(pieSlices(slices.map((slice) => slice.count)));
</script>

<!-- Hidden from screen readers: the legend beside each chart gives the same counts. -->
<svg viewBox="0 0 {PIE_CENTER * 2} {PIE_CENTER * 2}" class="w-full h-full" aria-hidden="true">
    {#each shapes as shape, index (index)}
        {#if shape?.full}
            <circle
                cx={PIE_CENTER}
                cy={PIE_CENTER}
                r={PIE_RADIUS}
                fill={slices[index].color}
                stroke="white"
                stroke-width="2"
            />
        {:else if shape}
            <path d={shape.path} fill={slices[index].color} stroke="white" stroke-width="2" />
        {/if}
    {/each}
</svg>
