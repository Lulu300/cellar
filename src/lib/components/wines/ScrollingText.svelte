<script lang="ts">
    import type { Snippet } from 'svelte';

    /**
     * One line of text that keeps its place in a card whatever its length. When it is really cut
     * (measured, not guessed from its length), it fades out on the right and, while the pointer is
     * over the card (an ancestor with the `scroll-text-host` class), scrolls to its end and back.
     * No movement with reduced motion, nor on a screen without hover, where `wrap` gives the text
     * two lines instead. The pointer goes through it, to the link that covers the card; that link
     * goes around it, never inside, since the fade would mask it too.
     */
    let {
        children,
        class: className = '',
        wrap = false
    }: { children: Snippet; class?: string; wrap?: boolean } = $props();

    let box = $state<HTMLElement>();
    let text = $state<HTMLElement>();
    // How far the text moves to show its end: 0, or less when it is cut
    let shift = $state(0);

    $effect(() => {
        if (!box || !text) return;
        const [outer, inner] = [box, text];
        // Both sizes: the card's width changes with the window, the text's with the data
        const observer = new ResizeObserver(() => {
            shift = Math.min(0, outer.clientWidth - inner.offsetWidth);
        });
        observer.observe(outer);
        observer.observe(inner);
        return () => observer.disconnect();
    });
</script>

<span
    bind:this={box}
    class="scrolling-text {className}"
    class:cut={shift < 0}
    class:wrap
    style:--shift="{shift}px"
>
    <span bind:this={text}>{@render children()}</span>
</span>

<style>
    /* Its fade or its moving text paints it above the card's link, whose clicks it must not take */
    .scrolling-text {
        pointer-events: none;
        display: block;
        overflow: hidden;
        white-space: nowrap;
    }
    .scrolling-text > span {
        display: inline-block;
    }
    .cut {
        mask-image: linear-gradient(to right, #000 80%, transparent);
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
        :global(.scroll-text-host:hover) .cut {
            mask-image: none;
        }
        :global(.scroll-text-host:hover) .cut > span {
            animation: scroll-text 6s ease-in-out 0.4s infinite alternate;
        }
    }
    @keyframes scroll-text {
        0%,
        12% {
            transform: none;
        }
        88%,
        100% {
            transform: translateX(var(--shift));
        }
    }
    @media (hover: none) {
        .wrap {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            white-space: normal;
            height: 2lh;
        }
        .wrap > span {
            display: inline;
        }
    }
</style>
