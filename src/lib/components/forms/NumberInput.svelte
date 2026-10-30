<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { readNumber } from '#lib/shared/schemas/form.js';
    import { formatInputNumber } from '#lib/utils/format.js';
    import { Input } from '#lib/components/ui/input/index.js';

    /**
     * A number field that Cellar reads itself, as `readNumber` does: "12,5" and "12.5" alike,
     * whatever the language of the browser. `value` is null while the field is empty, and the
     * text itself while it is not a number, for the checks to refuse it rather than lose it. A
     * number set from outside, such as a preset applied, shows in the language of the interface.
     */
    let {
        value = $bindable(),
        ...attributes
    }: { value: number | string | null } & Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> =
        $props();

    /** What the user typed last: shown while it still reads as `value`, which may change. */
    let text = $state('');
</script>

<Input
    type="text"
    inputmode="decimal"
    bind:value={
        () => {
            if (readNumber(text) === value) return text;
            return typeof value === 'string' ? value : formatInputNumber(value);
        },
        (typed: string) => {
            text = typed;
            value = readNumber(typed);
        }
    }
    {...attributes}
/>
