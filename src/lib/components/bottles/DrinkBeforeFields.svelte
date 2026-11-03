<script lang="ts">
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { Label } from '#lib/components/ui/label/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { getLocale } from '#lib/paraglide/runtime.js';
    import { monthOf } from '#lib/shared/drinking.js';

    /**
     * A « drink before »: a year, from this one to 15 years on, and a month or the whole year,
     * as YYYY or YYYY-MM. With `optional`, the year may be left without a date, as an empty value;
     * a date already set before this year stays among the years.
     */
    let {
        value = $bindable(),
        optional = false,
        disabled = false
    }: { value: string; optional?: boolean; disabled?: boolean } = $props();

    const thisYear = monthOf(new Date()).year;
    const [initialYear = '', initialMonth = ''] = value.split('-');
    // svelte-ignore state_referenced_locally
    let year = $state(initialYear || (optional ? '' : String(thisYear)));
    let month = $state(initialMonth);
    $effect(() => {
        value = year && month ? `${year}-${month}` : year;
    });

    // The props are read once: the dialog and the form mount the fields for each bottle.
    const firstYear = Math.min(Number(initialYear) || thisYear, thisYear);
    // svelte-ignore state_referenced_locally
    const years = [
        ...(optional ? [{ value: '', label: m['drinking.no_date']() }] : []),
        ...Array.from({ length: thisYear + 16 - firstYear }, (_, i) => {
            const text = String(firstYear + i);
            return { value: text, label: text };
        })
    ];
    const monthName = new Intl.DateTimeFormat(getLocale(), { month: 'long' });
    const months = [
        { value: '', label: m['drinking.whole_year']() },
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
