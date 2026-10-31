<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { abbreviate } from '#lib/utils/format.js';
    import { themes } from '#lib/utils/theme-colors.js';

    interface Bar {
        /** Unique among the bars. */
        key: string | number;
        name: string;
        /** A second line under the name, such as the country of a region whose name is shared. */
        detail?: string;
        /** Available bottles. */
        count: number;
    }

    /**
     * Bottle counts as bars, a name under each, cut past `cut.max` characters. A phone has no
     * hover to show a cut name in a tooltip: the line under the chart gives the whole name and the
     * count of the bar chosen by a tap, a click or the keyboard, the first one until then.
     */
    let { bars, cut }: { bars: Bar[]; cut?: { max: number; keep: number } } = $props();

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
    const short = (name: string) => (cut ? abbreviate(name, cut.max, cut.keep) : name);
    const wholeName = (bar: Bar) => (bar.detail ? `${bar.name} (${bar.detail})` : bar.name);
    const summary = (bar: Bar) =>
        `${m['common.label']({ label: wholeName(bar) })} ${m['common.n_bottles']({ count: bar.count })}`;
</script>

<div class="h-[300px] flex items-end justify-center gap-2 px-2">
    {#each bars as bar (bar.key)}
        <button
            type="button"
            class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            aria-pressed={bar === chosen}
            aria-label={summary(bar)}
            title={wholeName(bar)}
            onclick={() => (chosenKey = bar.key)}
        >
            <span class="text-sm font-bold">{bar.count}</span>
            <span
                class="w-full rounded-t-sm transition-all duration-500"
                style="height: {height(bar)}px; background: {background}"
            ></span>
            <!-- As tall for every bar, which keeps the bars on one line whatever their names. -->
            <span
                class="h-12 w-full overflow-hidden break-words text-center text-xs font-medium leading-tight group-aria-pressed:underline"
            >
                {short(bar.name)}
                {#if bar.detail}
                    <span class="block font-normal text-muted-foreground">{short(bar.detail)}</span>
                {/if}
            </span>
        </button>
    {/each}
</div>
{#if chosen}
    <p class="mt-2 text-center text-sm" aria-live="polite">{summary(chosen)}</p>
{/if}
