<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import {
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import ScrollRegion from '#lib/components/layout/ScrollRegion.svelte';
    import { cn } from '#lib/utils.js';

    let {
        title,
        icon: Icon,
        iconClass,
        description,
        error,
        class: className,
        toolbar,
        children,
        footer
    }: {
        /** The title, or what the heading holds when it is more than text, such as a link. */
        title: string | Snippet;
        /** Shown before the title, in the theme colour. */
        icon?: Component<{ class?: string }>;
        /** The icon's colour, when it says more than the theme's, such as a warning. */
        iconClass?: string;
        description?: string;
        /** Shown above the buttons, where the action that failed is, and read out when it appears. */
        error?: string;
        /** The dialog's width, such as `max-w-2xl`. */
        class?: string;
        /** Under the title, out of the scrolling body: what must stay in view, such as the actions
         * on a selection. */
        toolbar?: Snippet;
        children: Snippet;
        /** What stays in view under the body: the buttons, or a pagination. */
        footer?: Snippet;
    } = $props();
</script>

<!-- A dialog as tall as its content, up to 85 % of the visible height (dvh, which leaves out the
     address bar of a phone): between the title and the buttons, which stay in view, the body
     scrolls, so that a phone always shows both. -->
<DialogContent class={cn('max-h-[85dvh] flex flex-col', className)}>
    <!-- Padded at the end, so that a long title wraps before the close cross of the corner. -->
    <DialogHeader class="flex-shrink-0 pe-6">
        <DialogTitle class={Icon ? 'flex items-center gap-2' : undefined}>
            {#if Icon}
                <Icon class={cn('h-5 w-5 shrink-0 text-primary', iconClass)} />
            {/if}
            {#if typeof title === 'string'}
                {title}
            {:else}
                {@render title()}
            {/if}
        </DialogTitle>
        {#if description}
            <DialogDescription>{description}</DialogDescription>
        {/if}
    </DialogHeader>
    <!-- Without a box of its own: a toolbar with nothing to show, such as a selection bar while
         nothing is ticked, takes no room. -->
    {@render toolbar?.()}
    <!-- Pulled out by its padding, so that its content lines up with the title and the buttons. -->
    <ScrollRegion class="flex-1 min-h-0 -mx-1">
        {@render children()}
    </ScrollRegion>
    {#if footer || error}
        <div class="flex-shrink-0 space-y-2 border-t pt-4">
            {#if error}
                <p class="text-sm text-destructive" role="alert">{error}</p>
            {/if}
            {#if footer}
                <div class="flex flex-wrap justify-end gap-2">
                    {@render footer()}
                </div>
            {/if}
        </div>
    {/if}
</DialogContent>
