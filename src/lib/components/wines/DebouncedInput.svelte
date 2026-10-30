<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { Input } from '#lib/components/ui/input/index.js';
    import { DebouncedText } from '#lib/components/wines/debounced-text.svelte.js';

    /** A field of the wine list whose value lives in the URL, passed on once typing pauses. */
    let {
        value,
        onChange,
        ...attributes
    }: {
        value: string;
        onChange: (value: string) => void;
    } & Omit<HTMLInputAttributes, 'value' | 'oninput' | 'type' | 'files'> & {
            type?: 'text' | 'number';
        } = $props();

    const field = new DebouncedText(
        untrack(() => value),
        (text) => onChange(text)
    );

    $effect(() => field.follow(value));

    onDestroy(() => field.stop());
</script>

<Input bind:value={field.text} oninput={() => field.input()} {...attributes} />
