<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import { cn } from '#lib/utils.js';

    let {
        label,
        labelledby,
        class: className,
        children
    }: {
        /** The region's name, or the ids of the elements that name it. Without either, the box
         * still takes the focus when it scrolls, but is not a region: a dialog's body, which
         * the dialog names already. */
        label?: string;
        labelledby?: string;
        class?: string;
        children: Snippet;
    } = $props();

    // A box that scrolls with nothing focusable in it cannot be scrolled from the keyboard (WCAG
    // 2.1.1, axe scrollable-region-focusable): while its content overflows, it takes the focus
    // itself. A box that fits, or whose fields and buttons the keyboard scrolls to, stays out of
    // the tab order and of the regions.
    const FOCUSABLE =
        'a[href], button:not([disabled]), input:not([disabled], [type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableWhileScrolling: Attachment<HTMLElement> = (box) => {
        const setOrRemove = (name: string, value: string | false | undefined) => {
            if (value) box.setAttribute(name, value);
            else box.removeAttribute(name);
        };
        const update = () => {
            const focusable = box.scrollHeight > box.clientHeight && !box.querySelector(FOCUSABLE);
            setOrRemove('tabindex', focusable && '0');
            const named = focusable && !!(label || labelledby);
            setOrRemove('role', named && 'region');
            setOrRemove('aria-label', named && label);
            setOrRemove('aria-labelledby', named && labelledby);
        };
        update();
        // The box resizes with the screen; its content grows when a list expands.
        const resizes = new ResizeObserver(update);
        resizes.observe(box);
        const mutations = new MutationObserver(update);
        mutations.observe(box, { childList: true, subtree: true, characterData: true });
        return () => {
            resizes.disconnect();
            mutations.disconnect();
        };
    };
</script>

<!-- The padding keeps the content clear of the focus outline, drawn inside the box, where a
     scrolling box around it cannot clip it. -->
<div
    class={cn(
        'overflow-y-auto rounded p-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        className
    )}
    {@attach focusableWhileScrolling}
>
    {@render children()}
</div>
