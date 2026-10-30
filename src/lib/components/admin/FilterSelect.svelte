<script lang="ts">
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';

    /** A filter of an admin list: "all" (the empty value), or one of `options`. */
    let {
        value = $bindable(''),
        allLabel,
        options,
        onchange
    }: {
        value: string;
        /** The label of the empty value, which also names the filter for screen readers. */
        allLabel: string;
        options: { value: string; label: string }[];
        onchange?: () => void;
    } = $props();
</script>

<OptionSelect
    bind:value
    options={[{ value: '', label: allLabel }, ...options]}
    aria-label={allLabel}
    onValueChange={onchange}
    class="w-auto"
/>
