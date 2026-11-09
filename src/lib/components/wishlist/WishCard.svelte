<script lang="ts">
    import { BottleWine, Plus, SquarePen, Trash2, Wine } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import type { Wish } from './wishes.js';
    import { iconButton } from '#lib/components/layout/button-states.js';

    /**
     * A wish of the list: a wine of the cellar, which takes bottles, or a text, whose wine is
     * created first.
     */
    let {
        wish,
        showImage,
        onAddBottle,
        onCreateWine,
        onEdit,
        onRemove
    }: {
        wish: Wish;
        showImage: boolean;
        onAddBottle: (wish: Wish) => void;
        onCreateWine: (wish: Wish) => void;
        onEdit: (wish: Wish) => void;
        onRemove: (wish: Wish) => void;
    } = $props();

    const name = $derived(wish.wine?.name ?? wish.text ?? '');
    const imageUrl = $derived(wish.wine ? wish.wine.imageUrl : wish.imageUrl);
</script>

<Card class="py-0">
    <CardContent class="flex gap-4 p-4">
        {#if showImage}
            {#if imageUrl}
                <img
                    src={imageUrl}
                    alt={name}
                    class="h-20 w-16 shrink-0 rounded-lg border object-cover"
                />
            {:else}
                <div
                    class="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
                >
                    <Wine class="h-6 w-6" aria-hidden="true" />
                </div>
            {/if}
        {/if}

        <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-start justify-between gap-2">
                <h2 class="text-lg font-semibold break-words">
                    {#if wish.wine}
                        <a href="/wines/{wish.wine.id}" class="hover:text-primary-text">{name}</a>
                    {:else}
                        {name}
                    {/if}
                </h2>
                {#if auth.isAuthenticated}
                    <div class="flex shrink-0">
                        <button
                            type="button"
                            class={iconButton}
                            title={m['wishlist.edit']()}
                            aria-label={m['wishlist.edit_named']({ name })}
                            onclick={() => onEdit(wish)}
                        >
                            <SquarePen class="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            class={iconButton}
                            title={m['wishlist.remove']()}
                            aria-label={m['wishlist.remove_named']({ name })}
                            onclick={() => onRemove(wish)}
                        >
                            <Trash2 class="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                {/if}
            </div>

            {#if wish.wine}
                <p class="text-sm text-muted-foreground">
                    {[
                        wish.wine.producer,
                        wish.wine.appellation,
                        wish.wine.region,
                        wish.wine.country
                    ]
                        .filter(Boolean)
                        .join(' • ')}
                </p>
            {:else}
                <p class="text-sm text-muted-foreground">{m['wishlist.not_in_cellar']()}</p>
            {/if}

            <div class="flex flex-wrap gap-2 pt-1">
                {#if wish.quantity}
                    <Badge variant="secondary">
                        {m['wishlist.to_buy']({ count: wish.quantity })}
                    </Badge>
                {/if}
                {#if wish.wine}
                    <Badge variant="outline">
                        <BottleWine class="mr-1 h-3 w-3" aria-hidden="true" />
                        {m['wishlist.in_cellar']({ count: wish.wine.inCellar })}
                    </Badge>
                {/if}
            </div>

            {#if wish.note}
                <p class="text-sm whitespace-pre-line">{wish.note}</p>
            {/if}

            {#if auth.isAuthenticated}
                <div class="pt-2">
                    {#if wish.wine}
                        <Button
                            size="sm"
                            aria-label={m['wishlist.bought_some_named']({ name })}
                            onclick={() => onAddBottle(wish)}
                        >
                            <BottleWine class="mr-2 h-4 w-4" aria-hidden="true" />
                            {m['wishlist.bought_some']()}
                        </Button>
                    {:else}
                        <Button size="sm" onclick={() => onCreateWine(wish)}>
                            <Plus class="mr-2 h-4 w-4" />
                            {m['wishlist.create_wine']()}
                        </Button>
                    {/if}
                </div>
            {/if}
        </div>
    </CardContent>
</Card>
