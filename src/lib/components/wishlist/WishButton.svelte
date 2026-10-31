<script lang="ts">
    import { Heart } from '@lucide/svelte';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/state';
    import { errorMessage } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { addWish, removeWish } from './wishes.js';

    /**
     * The heart of a wine, on its card and its page: a press puts the wine on the wishlist, and
     * another takes it off.
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
    class={className}
    aria-pressed={!!wishId}
    aria-label={m['navigation.wishlist']()}
    title={wishId ? m['wishlist.remove_from_wishlist']() : m['wishlist.add_to_wishlist']()}
    disabled={busy}
    onclick={toggle}
>
    <Heart
        class="{iconClass} {wishId ? 'fill-current text-primary-text' : ''}"
        aria-hidden="true"
    />
</button>
