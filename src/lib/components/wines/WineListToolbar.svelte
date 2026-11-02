<script lang="ts">
    import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronRight } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import ChoiceButtons from '#lib/components/preferences/ChoiceButtons.svelte';
    import DebouncedInput from '#lib/components/wines/DebouncedInput.svelte';
    import { viewOptions } from '#lib/components/wines/wine-list.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { BottleCountMode, WineListQuery, WineListView } from '#lib/utils/wine-filters.js';
    import type { WineGroupSortKey } from '#lib/utils/wine-group-sort.js';
    import { focusRing } from '#lib/components/layout/button-states.js';

    /**
     * The count of what the list shows with a link to the bottles out of the cellar, its sort, the
     * bottle-count filter, the images switch and the choice of cards or list.
     */
    let {
        query,
        onChange,
        wineCount,
        bottleCount,
        outOfCellarCount,
        view,
        showImages = $bindable()
    }: {
        query: WineListQuery;
        onChange: (changes: Partial<WineListQuery>) => void;
        wineCount: number;
        bottleCount: number;
        /** All the bottles taken out of the cellar, whatever the filters, as the page it links to. */
        outOfCellarCount: number;
        /** The view shown, which a choice here puts in the URL. */
        view: WineListView;
        showImages: boolean;
    } = $props();

    const sortOptions = $derived([
        { value: 'name', label: m['wines.sort_name']() },
        { value: 'producer', label: m['common.producer']() },
        { value: 'vintage', label: m['wines.sort_oldest_vintage']() },
        { value: 'price', label: m['wines.sort_average_price']() },
        { value: 'rating', label: m['wine_details.rating']() },
        { value: 'bottles', label: m['wines.bottle_count']() }
    ] satisfies Array<{ value: WineGroupSortKey; label: string }>);
    const sortLabel = $derived(
        sortOptions.find((option) => option.value === query.sort)?.label ?? ''
    );
    const sortDirectionLabel = $derived(
        query.dir === 'asc' ? m['wines.sort_ascending']() : m['wines.sort_descending']()
    );

    const countModes = $derived([
        { value: '', label: m['common.all']() },
        { value: 'none', label: m['wines.no_bottles']() },
        { value: 'exact', label: m['wines.exact_count']() },
        { value: 'at_least', label: m['wines.at_least']() },
        { value: 'less_than', label: m['wines.less_than']() }
    ] satisfies Array<{ value: BottleCountMode; label: string }>);
    const countModeLabel = $derived(
        countModes.find((mode) => mode.value === query.bottles)?.label ?? ''
    );
</script>

<div class="mt-4 flex flex-wrap justify-between items-center gap-4">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{m['wines.summary']({ wines: wineCount, bottles: bottleCount })}</span>
        {#if outOfCellarCount > 0}
            <a
                href="/out-of-cellar"
                class="inline-flex items-center font-medium text-primary-text underline decoration-primary/40 underline-offset-[3px] hover:decoration-primary"
            >
                {m['wines.out_of_cellar_link']({ count: outOfCellarCount })}
                <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </a>
        {/if}
    </div>
    <div class="flex flex-wrap items-center gap-4">
        <!-- The label wraps above the select on narrow screens -->
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground whitespace-nowrap">
                {m['wines.sort_by']()}
            </span>
            <div class="flex items-center gap-2">
                <Select.Root
                    type="single"
                    value={query.sort}
                    onValueChange={(sort) => onChange({ sort: sort as WineGroupSortKey })}
                >
                    <!-- Its name repeats the label it shows, which speech input users say -->
                    <Select.Trigger
                        class="min-w-[180px] h-8"
                        aria-label={m['wines.sort_by_value']({ value: sortLabel })}
                    >
                        {sortLabel}
                    </Select.Trigger>
                    <Select.Content>
                        {#each sortOptions as option (option.value)}
                            <Select.Item value={option.value} label={option.label}
                                >{option.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8"
                    onclick={() => onChange({ dir: query.dir === 'asc' ? 'desc' : 'asc' })}
                    title={sortDirectionLabel}
                    aria-label={sortDirectionLabel}
                >
                    {#if query.dir === 'asc'}
                        <ArrowUpNarrowWide class="h-4 w-4" aria-hidden="true" />
                    {:else}
                        <ArrowDownWideNarrow class="h-4 w-4" aria-hidden="true" />
                    {/if}
                </Button>
            </div>
        </div>
        <!-- Bottle count filter -->
        <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground whitespace-nowrap">
                {m['wines.bottle_count']()}
            </span>
            <Select.Root
                type="single"
                value={query.bottles}
                onValueChange={(bottles) => onChange({ bottles: bottles as BottleCountMode })}
            >
                <!-- A combobox takes no name from its text: like the sort, it says both -->
                <Select.Trigger
                    class="w-[140px] h-8"
                    aria-label={m['wines.bottle_count_value']({ value: countModeLabel })}
                >
                    {countModeLabel}
                </Select.Trigger>
                <Select.Content>
                    {#each countModes as mode (mode.value)}
                        <Select.Item value={mode.value} label={mode.label}>{mode.label}</Select.Item
                        >
                    {/each}
                </Select.Content>
            </Select.Root>
            {#if query.bottles && query.bottles !== 'none'}
                <DebouncedInput
                    type="number"
                    value={query.count}
                    onChange={(count) => onChange({ count })}
                    min="0"
                    max="999"
                    aria-label={m['wines.bottle_count_number']({ mode: countModeLabel })}
                    class="h-8 w-16"
                />
            {/if}
        </div>
        <!-- Show images toggle -->
        <div class="flex items-center space-x-2">
            <label for="show-images-toggle" class="text-sm text-muted-foreground">
                {m['wines.show_images']()}
            </label>
            <button
                id="show-images-toggle"
                type="button"
                role="switch"
                aria-checked={showImages}
                aria-label={m['wines.show_images']()}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {focusRing} {showImages
                    ? 'bg-primary hover:bg-primary-hover'
                    : 'bg-input hover:bg-input-hover'}"
                onclick={() => (showImages = !showImages)}
            >
                <span
                    class="inline-block h-4 w-4 transform rounded-full transition-transform {showImages
                        ? 'translate-x-6 bg-primary-foreground'
                        : 'translate-x-1 bg-background'}"
                ></span>
            </button>
        </div>
        <ChoiceButtons
            aria-label={m['wines.view']()}
            class="p-0.5"
            buttonClass="h-7"
            options={viewOptions()}
            value={view}
            onchange={(view) => onChange({ view })}
        />
    </div>
</div>
