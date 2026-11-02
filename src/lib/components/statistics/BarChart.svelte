<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { themes } from '#lib/utils/theme-colors.js';
    import { quietButton } from '#lib/components/layout/button-states.js';

    interface Bar {
        /** Unique among the bars. */
        key: string | number;
        name: string;
        /** Shown under the bar instead of `name`, which the line under the chart still gives. */
        short?: string;
        /** A second line under the name, such as the country of a region whose name is shared. */
        detail?: string;
        /** Available bottles. */
        count: number;
    }

    /**
     * Bottle counts as bars, a name under each on one line, cut by "…" when it is wider than its
     * bar. A phone has no hover to show a cut name in a tooltip: the line under the chart gives the
     * whole name and the count of the bar chosen by a tap, a click or the keyboard, the first one
     * until then.
     */
    let { bars }: { bars: Bar[] } = $props();

    let chosenKey = $state<Bar['key']>();
    const chosen = $derived(bars.find((bar) => bar.key === chosenKey) ?? bars[0]);
    const maxCount = $derived(Math.max(...bars.map((bar) => bar.count)));
    // The bars take the colour of the theme.
    const background = $derived.by(() => {
        const { primary } = themes[preferences.theme].preview;
        return `linear-gradient(to top, ${primary}, ${primary}cc)`;
    });

    // In pixels: 200 for the largest count, and never under 20, so that a small count shows.
    const height = (bar: Bar) => Math.max((bar.count / maxCount) * 200, 20);
    const wholeName = (bar: Bar) => (bar.detail ? `${bar.name} (${bar.detail})` : bar.name);
    const label = (bar: Bar) => m['common.label']({ label: wholeName(bar) });
    const bottles = (bar: Bar) => m['common.n_bottles']({ count: bar.count });
</script>

<div class="h-[300px] flex items-end justify-center gap-2 px-2">
    {#each bars as bar (bar.key)}
        <button
            type="button"
            class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-sm {quietButton}"
            aria-pressed={bar === chosen}
            aria-label="{label(bar)} {bottles(bar)}"
            title={wholeName(bar)}
            onclick={() => (chosenKey = bar.key)}
        >
            <span class="text-sm font-bold">{bar.count}</span>
            <span
                class="w-full rounded-t-sm transition-all duration-500"
                style="height: {height(bar)}px; background: {background}"
            ></span>
            <!-- Two lines high for every bar, the second one for a detail, which keeps the bars
                 aligned whatever their names. -->
            <span class="h-8 w-full text-center text-xs leading-tight">
                <span class="block truncate font-medium group-aria-pressed:underline"
                    >{bar.short ?? bar.name}</span
                >
                {#if bar.detail}
                    <span class="block truncate text-muted-foreground">{bar.detail}</span>
                {/if}
            </span>
        </button>
    {/each}
</div>
{#if chosen}
    <!-- Not read out on a change: the button gives a screen reader the same words. -->
    <p class="mt-2 text-center text-sm">
        {label(chosen)} <span class="whitespace-nowrap">{bottles(chosen)}</span>
    </p>
{/if}
