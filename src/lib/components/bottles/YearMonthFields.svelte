<script lang="ts">
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { Label } from '#lib/components/ui/label/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { getLocale } from '#lib/paraglide/runtime.js';
    import { monthOf } from '#lib/shared/drinking.js';

    /**
     * One end of a drinking window, a group named by `legend`: a year, or « Aucune date » for an
     * empty value, and a month or the whole year, as YYYY or YYYY-MM. The years go from this one
     * to 15 years on, and for the `start` of a window from 15 years back, as a guide may give a
     * window already open; a date already set out of that range stays among them.
     */
    let {
        value = $bindable(),
        legend,
        start = false,
        disabled = false
    }: {
        value: string;
        /** The name of the two selects together. */
        legend: string;
        /** The start of a window, whose year alone begins in January. */
        start?: boolean;
        disabled?: boolean;
    } = $props();

    const thisYear = monthOf(new Date()).year;
    const [initialYear = '', initialMonth = ''] = value.split('-');
    let year = $state(initialYear);
    let month = $state(initialMonth);
    $effect(() => {
        value = year && month ? `${year}-${month}` : year;
    });

    // The props are read once: the dialog and the form mount the fields for each bottle.
    // svelte-ignore state_referenced_locally
    const firstYear = Math.min(Number(initialYear) || thisYear, start ? thisYear - 15 : thisYear);
    const lastYear = Math.max(Number(initialYear) || thisYear, thisYear + 15);
    const years = [
        { value: '', label: m['drinking.no_date']() },
        ...Array.from({ length: lastYear - firstYear + 1 }, (_, i) => {
            const text = String(firstYear + i);
            return { value: text, label: text };
        })
    ];
    const monthName = new Intl.DateTimeFormat(getLocale(), { month: 'long' });
    // svelte-ignore state_referenced_locally
    const months = [
        { value: '', label: start ? m['drinking.start_of_year']() : m['drinking.whole_year']() },
        ...Array.from({ length: 12 }, (_, i) => {
            const name = monthName.format(new Date(2000, i, 1));
            return {
                value: String(i + 1).padStart(2, '0'),
                label: name.charAt(0).toLocaleUpperCase() + name.slice(1)
            };
        })
    ];

    const id = $props.id();
</script>

<!-- A group named by `legend`, so that each select keeps its own label. -->
<fieldset class="space-y-2">
    <legend class="mb-2 text-sm font-medium leading-none">{legend}</legend>
    <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
            <Label for="{id}-year">{m['drinking.year']()}</Label>
            <OptionSelect id="{id}-year" bind:value={year} options={years} {disabled} />
        </div>
        <div class="space-y-2">
            <Label for="{id}-month">{m['drinking.month']()}</Label>
            <OptionSelect
                id="{id}-month"
                bind:value={month}
                options={months}
                disabled={disabled || !year}
            />
        </div>
    </div>
</fieldset>
