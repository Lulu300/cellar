<script lang="ts">
    import type { Snippet } from 'svelte';
    import { chosenTile, quietButton } from '#lib/components/layout/button-states.js';
    import { cn } from '#lib/utils.js';

    /**
     * A filter that a click turns on or off, as a chip that tells whether it is on (`aria-pressed`).
     * Off, it takes the hover of a quiet button; on, the tint of a chosen tile rather than the fill
     * of a button (UI-33), so that the colour of a mark or a wine inside it keeps showing.
     */
    let {
        pressed,
        onclick,
        children
    }: {
        pressed: boolean;
        onclick: () => void;
        children: Snippet;
    } = $props();
</script>

<button
    type="button"
    aria-pressed={pressed}
    class={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        pressed ? cn(chosenTile, 'border-primary') : quietButton
    )}
    {onclick}
>
    {@render children()}
</button>
