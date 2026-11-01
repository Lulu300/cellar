<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { ClassValue } from 'svelte/elements';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { wineColorStyle } from '#lib/utils/wine-color.js';

    /**
     * The badge of a wine colour, filled with its colour value, its text black or white, and an
     * edge of the same hue where the colour alone would not stand out from the card.
     */
    let {
        name,
        hex,
        class: className,
        children
    }: {
        name: string;
        hex: string;
        class?: ClassValue;
        /** What the badge shows instead of the name, such as the name in a span of its own. */
        children?: Snippet;
    } = $props();
</script>

<Badge
    class={['wine-color border-(--wine-edge) bg-(--wine) text-(--wine-text)', className]}
    style={wineColorStyle(hex)}
>
    {#if children}{@render children()}{:else}{name}{/if}
</Badge>
