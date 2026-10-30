<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '#lib/utils.js';

    let {
        label,
        class: className,
        children
    }: {
        /** The region's accessible name, which a screen reader announces when it takes the focus. */
        label: string;
        class?: string;
        children: Snippet;
    } = $props();
</script>

<!-- A box that scrolls with nothing focusable in it: it takes the focus itself, so that the
     keyboard can scroll it (WCAG 2.1.1, axe scrollable-region-focusable). The outline is drawn
     inside, where the scrolling box around it cannot clip it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    role="region"
    aria-label={label}
    tabindex="0"
    class={cn(
        'overflow-y-auto rounded focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        className
    )}
>
    {@render children()}
</div>
