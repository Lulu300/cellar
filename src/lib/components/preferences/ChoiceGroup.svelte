<script lang="ts" generics="Value extends string | boolean">
    import type { Snippet } from 'svelte';
    import ChoiceButtons from './ChoiceButtons.svelte';

    /**
     * A preference with a few choices, as buttons that work as radios: the group is named by the
     * preference and described by its description, and tells which choice is on.
     */
    let {
        label,
        description,
        options,
        value,
        onchange,
        chooseWithArrows = true,
        children
    }: {
        label: string;
        description: string;
        options: { value: Value; label: string }[];
        value: Value;
        onchange: (value: Value) => void;
        /** False when a choice reloads the page: the arrows then only move between choices. */
        chooseWithArrows?: boolean;
        /** Shown under the description. */
        children?: Snippet;
    } = $props();

    const id = $props.id();
</script>

<div class="flex items-center justify-between gap-4">
    <div>
        <p id="{id}-label" class="text-base font-medium leading-none">{label}</p>
        <p id="{id}-description" class="text-sm text-muted-foreground">{description}</p>
        {@render children?.()}
    </div>
    <ChoiceButtons
        aria-labelledby="{id}-label"
        aria-describedby="{id}-description"
        {options}
        {value}
        {onchange}
        {chooseWithArrows}
    />
</div>
