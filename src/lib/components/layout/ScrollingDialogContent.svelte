<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import { DialogContent, DialogHeader, DialogTitle } from '#lib/components/ui/dialog/index.js';
    import ScrollRegion from '#lib/components/layout/ScrollRegion.svelte';
    import { cn } from '#lib/utils.js';

    let {
        title,
        icon: Icon,
        error,
        class: className,
        children,
        footer
    }: {
        title: string;
        /** Shown before the title, in the theme colour. */
        icon?: Component<{ class?: string }>;
        /** Shown above the buttons, where the action that failed is, and read out when it appears. */
        error?: string;
        /** The dialog's width, such as `max-w-2xl`. */
        class?: string;
        children: Snippet;
        /** The buttons. */
        footer: Snippet;
    } = $props();
</script>

<!-- A dialog as tall as its content, up to 85 % of the screen: between the title and the buttons,
     which stay in view, the body scrolls, so that a phone always shows both. -->
<DialogContent class={cn('max-h-[85vh] flex flex-col', className)}>
    <DialogHeader class="flex-shrink-0">
        <DialogTitle class={Icon ? 'flex items-center gap-2' : undefined}>
            {#if Icon}
                <Icon class="h-5 w-5 shrink-0 text-primary" />
            {/if}
            {title}
        </DialogTitle>
    </DialogHeader>
    <ScrollRegion class="flex-1 min-h-0">
        {@render children()}
    </ScrollRegion>
    <div class="flex-shrink-0 space-y-2 border-t pt-4">
        {#if error}
            <p class="text-sm text-destructive" role="alert">{error}</p>
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
            {@render footer()}
        </div>
    </div>
</DialogContent>
