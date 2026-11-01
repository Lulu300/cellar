<script lang="ts">
    import { Bookmark } from '@lucide/svelte';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { toggleWish } from './wishes.js';

    /**
     * The bookmark of a wine, on its card, its row and its page, filled while the wine is on the
     * wishlist: a press puts the wine on the list, and another takes it off. `class` styles the
     * button; the filled bookmark, in the theme's colour, takes the button's own hover colour.
     */
    let {
        wineId,
        class: className = '',
        iconClass = 'h-4 w-4'
    }: { wineId: string; class?: string; iconClass?: string } = $props();

    // Loaded by the root layout, and reloaded after each change
    const wishId = $derived<string | undefined>(page.data.wishedWines?.[wineId]);
    let busy = $state(false);

    async function toggle() {
        busy = true;
        await toggleWish(wineId, wishId);
        busy = false;
    }
</script>

<button
    type="button"
    class="group/wish {className}"
    aria-pressed={!!wishId}
    aria-label={m['navigation.wishlist']()}
    title={wishId ? m['wishlist.remove_from_wishlist']() : m['wishlist.add_to_wishlist']()}
    disabled={busy}
    onclick={toggle}
>
    <Bookmark
        class="{iconClass} {wishId
            ? 'fill-current text-primary-text transition-colors group-hover/wish:text-inherit'
            : ''}"
        aria-hidden="true"
    />
</button>
