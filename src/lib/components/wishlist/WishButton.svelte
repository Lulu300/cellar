<script lang="ts">
    import { Bookmark } from '@lucide/svelte';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/state';
    import { errorMessage } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { addWish, removeWish } from './wishes.js';

    /**
     * The bookmark of a wine, on its card and its page, filled while the wine is on the wishlist:
     * a press puts the wine on the list, and another takes it off. `overlay` lays it over a photo,
     * as a white bookmark on a dark disc that stays readable over any photo, in every theme;
     * `class` styles it otherwise.
     */
    let {
        wineId,
        class: className = '',
        iconClass = 'h-4 w-4',
        overlay = false
    }: { wineId: string; class?: string; iconClass?: string; overlay?: boolean } = $props();

    // Loaded by the root layout, and reloaded after each change
    const wishId = $derived<string | undefined>(page.data.wishedWines?.[wineId]);
    let busy = $state(false);

    async function toggle() {
        busy = true;
        try {
            if (wishId) {
                await removeWish(wishId);
            } else {
                await addWish({ definitionId: wineId });
                toasts.add(m['wishlist.added'](), 'success');
                await invalidate(CELLAR);
            }
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        } finally {
            busy = false;
        }
    }
</script>

<button
    type="button"
    class={overlay
        ? 'absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/75'
        : className}
    aria-pressed={!!wishId}
    aria-label={m['navigation.wishlist']()}
    title={wishId ? m['wishlist.remove_from_wishlist']() : m['wishlist.add_to_wishlist']()}
    disabled={busy}
    onclick={toggle}
>
    <Bookmark
        class="{iconClass} {wishId
            ? overlay
                ? 'fill-current'
                : 'fill-current text-primary-text'
            : ''}"
        aria-hidden="true"
    />
</button>
