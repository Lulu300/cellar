<script lang="ts">
    import { onMount } from 'svelte';
    import { Bookmark } from '@lucide/svelte';
    import { invalidate } from '$app/navigation';
    import { errorMessage } from '#lib/api/client.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import WineDefinitionDialog from '#lib/components/wines/WineDefinitionDialog.svelte';
    import WishAdd from '#lib/components/wishlist/WishAdd.svelte';
    import WishCard from '#lib/components/wishlist/WishCard.svelte';
    import WishDialog from '#lib/components/wishlist/WishDialog.svelte';
    import { removeWish, replaceWish, type Wish } from '#lib/components/wishlist/wishes.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { SavedDefinitionDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // Read once at mount, as the shortage tab does: the server renders the images.
    let showImages = $state(true);
    onMount(() => {
        showImages = preferences.showImages;
    });

    // The wish whose dialog is open
    let editing = $state.raw<Wish | null>(null);

    // The text wish whose wine the wine dialog creates
    let creating = $state.raw<Wish | null>(null);
    let showWineDialog = $state(false);

    // The wine that the bottle dialog adds bottles to
    let bottleWineId = $state<string>();
    let showBottleDialog = $state(false);

    function openBottleDialog(wineId: string) {
        bottleWineId = wineId;
        showBottleDialog = true;
    }

    function createWine(wish: Wish) {
        creating = wish;
        showWineDialog = true;
    }

    /**
     * The wine of a text wish is saved: the wish becomes a wish for that wine, with its quantity
     * and note, and stays on the list; then come its bottles, when asked.
     */
    async function wineCreated(wine: SavedDefinitionDTO, addBottle: boolean) {
        const wish = creating!;
        try {
            await replaceWish(wish.id, {
                definitionId: wine.id,
                quantity: wish.quantity,
                note: wish.note
            });
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        }
        await invalidate(CELLAR);
        if (addBottle) openBottleDialog(wine.id);
    }

    async function remove(wish: Wish) {
        const confirmed = await confirm({
            message: m['wishlist.remove_confirm']({ name: wish.wine?.name ?? wish.text ?? '' }),
            confirmLabel: m['wishlist.remove']()
        });
        if (confirmed) await removeWish(wish.id);
    }
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.wishlist'](), m['navigation.purchases']())}</title>
    <meta name="description" content={m['wishlist.subtitle']()} />
</svelte:head>

<p class="mb-6 text-muted-foreground">{m['wishlist.subtitle']()}</p>

{#if auth.isAuthenticated}
    <WishAdd wines={data.wines} />
{/if}

{#if data.wishes.length === 0}
    <Card>
        <CardContent class="flex flex-col items-center gap-4 p-8 text-center">
            <div class="rounded-full bg-primary/10 p-4">
                <Bookmark class="h-8 w-8 text-primary-text" aria-hidden="true" />
            </div>
            <div>
                <h2 class="text-lg font-medium">{m['wishlist.empty']()}</h2>
                {#if auth.isAuthenticated}
                    <p class="mt-2 text-muted-foreground">{m['wishlist.empty_hint']()}</p>
                {/if}
            </div>
        </CardContent>
    </Card>
{:else}
    <ul class="grid gap-4 lg:grid-cols-2">
        {#each data.wishes as wish (wish.id)}
            <li>
                <WishCard
                    {wish}
                    showImage={showImages}
                    onAddBottle={(chosen) => openBottleDialog(chosen.wine!.id)}
                    onCreateWine={createWine}
                    onEdit={(chosen) => (editing = chosen)}
                    onRemove={remove}
                />
            </li>
        {/each}
    </ul>
{/if}

{#if editing}
    <WishDialog wish={editing} onClose={() => (editing = null)} />
{/if}

<WineDefinitionDialog
    bind:open={showWineDialog}
    draft={creating ? { name: creating.text ?? '', imageId: creating.imageId } : undefined}
    imageUrl={creating?.imageUrl ?? undefined}
    onSaved={wineCreated}
/>

<!-- Closing it after a save offers to take the wine off the list -->
<WineBottleDialog
    bind:open={showBottleDialog}
    selectedDefinitionId={bottleWineId}
    onSaved={() => invalidate(CELLAR)}
/>
