<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { getLocale } from '#lib/paraglide/runtime.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Calendar } from '@lucide/svelte';
    import { dateAfterInput, formatLocaleDate } from './locale-date';
    import { quietButton } from '#lib/components/layout/button-states.js';

    let {
        value = $bindable(''),
        id = '',
        name,
        disabled = false,
        invalid = false
    }: {
        value?: string;
        id?: string;
        name?: string;
        disabled?: boolean;
        /** Marks the field as refused by a form check. */
        invalid?: boolean;
    } = $props();

    let dateInput = $state<HTMLInputElement>();

    // A native form hears of each date typed in the text field, as from the date input it sends.
    $effect(() => {
        void value;
        if (name) dateInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // What the user types, until a new value replaces it
    let displayValue = $derived(formatLocaleDate(value, getLocale()));

    function handleInput() {
        value = dateAfterInput(displayValue, getLocale(), value);
    }

    // A half-typed date is not the value: show the value again rather than leave them apart.
    function handleBlur() {
        displayValue = formatLocaleDate(value, getLocale());
    }

    function openCalendar() {
        if (!disabled) {
            dateInput?.showPicker?.();
        }
    }
</script>

<div class="relative">
    <Input
        {id}
        type="text"
        bind:value={displayValue}
        {disabled}
        aria-invalid={invalid || undefined}
        placeholder={m['placeholders.date']()}
        oninput={handleInput}
        onblur={handleBlur}
        class="pr-10"
    />

    <!-- Calendar icon button -->
    <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 {quietButton}"
        {disabled}
        onclick={openCalendar}
        aria-label={m['forms.open_calendar']()}
    >
        <Calendar class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>

    <!-- Hidden date input for calendar picker -->
    <input
        type="date"
        bind:this={dateInput}
        bind:value
        {name}
        {disabled}
        class="absolute opacity-0 pointer-events-none -z-10"
        tabindex="-1"
        aria-hidden="true"
    />
</div>
