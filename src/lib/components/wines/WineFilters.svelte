<script lang="ts">
    import { page } from '$app/state';
    import { Label } from '#lib/components/ui/label/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import DebouncedInput from '#lib/components/wines/DebouncedInput.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { ReferencesDTO } from '#lib/shared/dto.js';
    import { nameIsShared } from '#lib/utils/compare.js';
    import type { VintageMode, WineListQuery } from '#lib/utils/wine-filters.js';

    type ReferenceRow = { id: string; name: string };

    /** The search and the filters on the wine itself, above the list. */
    let {
        query,
        onChange
    }: {
        query: WineListQuery;
        onChange: (changes: Partial<WineListQuery>) => void;
    } = $props();

    // The options of the filters, which the layout loads for every page
    const references: ReferencesDTO = $derived(page.data.references);

    // A region shows its country when another region has its name, as on the statistics page:
    // the filter compares ids, and the two must be told apart to be chosen.
    const regionOptions = $derived(
        references.regions.map((region) => ({
            id: region.id,
            name: nameIsShared(references.regions, region, (row) => row.name)
                ? `${region.name} (${region.countryName})`
                : region.name
        }))
    );

    // Every filter that offers a list binds the id of the option chosen.
    const referenceFilters = $derived([
        {
            name: 'type',
            label: m['common.type'](),
            options: references.wineTypes,
            placeholder: m['common.all_types'](),
            autoFocus: false
        },
        {
            name: 'color',
            label: m['common.color'](),
            options: references.wineColors,
            placeholder: m['common.all_colors'](),
            autoFocus: false
        },
        {
            name: 'region',
            label: m['common.region'](),
            options: regionOptions,
            placeholder: m['common.all_regions'](),
            autoFocus: true
        },
        {
            name: 'country',
            label: m['common.country'](),
            options: references.countries,
            placeholder: m['common.all_countries'](),
            autoFocus: true
        },
        {
            name: 'origin',
            label: m['common.origin'](),
            options: references.origins,
            placeholder: m['wines.all_origins'](),
            autoFocus: true
        }
    ] satisfies {
        name: 'type' | 'color' | 'region' | 'country' | 'origin';
        label: string;
        options: ReferenceRow[];
        placeholder: string;
        /** Whether focusing the field opens its list. */
        autoFocus: boolean;
    }[]);

    const vintageModes = $derived([
        { value: '', label: m['common.all_vintages']() },
        { value: 'no_vintage', label: m['wines.no_vintage']() },
        { value: 'range', label: m['wines.vintage_range']() }
    ] satisfies { value: VintageMode; label: string }[]);
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))] gap-4 min-h-[80px]">
    <div class="space-y-2">
        <Label for="search">{m['wines.search']()}</Label>
        <DebouncedInput
            id="search"
            value={query.search}
            onChange={(search) => onChange({ search })}
            placeholder={m['wines.search_placeholder']()}
        />
    </div>

    {#each referenceFilters as filter (filter.name)}
        <div class="space-y-2">
            <Label for={filter.name}>{filter.label}</Label>
            <SearchableSelect
                id={filter.name}
                bind:value={() => query[filter.name], (id) => onChange({ [filter.name]: id })}
                options={filter.options}
                placeholder={filter.placeholder}
                valueField="id"
                allowCreate={false}
                autoFocus={filter.autoFocus}
            />
        </div>
    {/each}

    <div class="space-y-2">
        <Label for="vintage-mode">{m['common.vintage']()}</Label>
        <Select.Root
            type="single"
            value={query.vintage}
            onValueChange={(vintage) => onChange({ vintage: vintage as VintageMode })}
        >
            <Select.Trigger id="vintage-mode" class="w-full">
                {vintageModes.find((mode) => mode.value === query.vintage)?.label}
            </Select.Trigger>
            <Select.Content>
                {#each vintageModes as mode (mode.value)}
                    <Select.Item value={mode.value} label={mode.label}>{mode.label}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    </div>

    {#if query.vintage === 'range'}
        <div class="space-y-2">
            <Label for="vintage-min">{m['wines.vintage_from']()}</Label>
            <DebouncedInput
                id="vintage-min"
                type="number"
                value={query.from}
                onChange={(from) => onChange({ from })}
                placeholder="1990"
                min="1800"
                max="2100"
            />
        </div>
        <div class="space-y-2">
            <Label for="vintage-max">{m['wines.vintage_to']()}</Label>
            <DebouncedInput
                id="vintage-max"
                type="number"
                value={query.to}
                onChange={(to) => onChange({ to })}
                placeholder="2024"
                min="1800"
                max="2100"
            />
        </div>
    {/if}
</div>
