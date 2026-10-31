<script lang="ts">
    import { Copy, SquarePen, SquarePlus, Star } from '@lucide/svelte';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import WishButton from '#lib/components/wishlist/WishButton.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { WineGroupDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { formatPriceRange, formatRating, formatVintageRange } from '#lib/utils/format.js';
    import { colorBadgeClass, typeBadgeClass } from '#lib/utils/wine-badges.js';
    import { priceStats, vintageRange } from '#lib/utils/wine-group-sort.js';

    type Wine = WineGroupDTO['definition'];

    /** A wine of the list, with what its bottles still owned add up to. */
    let {
        wine,
        bottles,
        imageUrl,
        showImage,
        onEdit,
        onDuplicate,
        onAddBottle,
        onShowBottles
    }: {
        wine: Wine;
        /** Its bottles still owned, the only ones that the list loads. */
        bottles: WineGroupDTO['bottles'];
        imageUrl: string | undefined;
        showImage: boolean;
        onEdit: (wine: Wine) => void;
        onDuplicate: (wine: Wine) => void;
        onAddBottle: (wine: Wine) => void;
        onShowBottles: (wine: Wine) => void;
    } = $props();

    const iconButton =
        'relative z-10 text-muted-foreground hover:text-foreground transition-colors rounded p-1 sm:p-1.5 min-h-[28px] sm:min-h-[32px] min-w-[28px] sm:min-w-[32px] flex items-center justify-center';
</script>

<!-- The link of the title covers the whole card (its ::after); the buttons sit above it,
     since a button inside a link is invalid HTML. -->
<div class="relative">
    <Card class="hover:shadow-lg transition-shadow py-0 wine-card-min-width">
        <CardContent class="p-4 wine-card-content">
            <div class="flex flex-col">
                {#if showImage}
                    <div class="mb-4 flex-shrink-0">
                        {#if imageUrl}
                            <img
                                src={imageUrl}
                                alt={wine.name}
                                class="w-full h-32 object-cover rounded"
                            />
                        {:else}
                            <div
                                class="w-full h-32 bg-muted rounded flex items-center justify-center"
                            >
                                <div class="text-center text-muted-foreground">
                                    <svg
                                        aria-hidden="true"
                                        class="w-8 h-8 mx-auto mb-2"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                                        />
                                    </svg>
                                    <span class="text-xs"
                                        >{m['wine_details.no_image_available']()}</span
                                    >
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <div class="flex flex-col">
                    <!-- Title and badges -->
                    <div class="mb-3 flex-shrink-0">
                        <div class="flex justify-between items-start">
                            <h2
                                class="text-lg font-semibold line-clamp-1 overflow-hidden truncate"
                                title={wine.name}
                            >
                                <a
                                    href="/wines/{wine.id}"
                                    class="after:absolute after:inset-0 after:content-['']"
                                    >{wine.name}</a
                                >
                            </h2>
                            {#if auth.isAuthenticated}
                                <div class="flex gap-1">
                                    <WishButton wineId={wine.id} class={iconButton} />
                                    <button
                                        class={iconButton}
                                        onclick={() => onEdit(wine)}
                                        title={m['forms.edit_wine']()}
                                        aria-label={m['forms.edit_wine']()}
                                    >
                                        <SquarePen class="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <button
                                        class={iconButton}
                                        onclick={() => onDuplicate(wine)}
                                        title={m['forms.duplicate_wine']()}
                                        aria-label={m['forms.duplicate_wine']()}
                                    >
                                        <Copy class="h-4 w-4" aria-hidden="true" />
                                    </button>
                                </div>
                            {/if}
                        </div>
                        <div class="flex flex-wrap gap-1">
                            <Badge class="{typeBadgeClass(wine.type)} text-xs">
                                {wine.type}
                            </Badge>
                            <Badge class="{colorBadgeClass(wine.color)} text-xs">
                                {wine.color}
                            </Badge>
                            <div class="flex items-center gap-1">
                                <button
                                    class="relative z-10 hover:opacity-80 transition-opacity"
                                    onclick={() => onShowBottles(wine)}
                                    title={m['wines.view_bottle_details']()}
                                >
                                    <Badge variant="secondary" class="text-xs cursor-pointer">
                                        {m['common.n_bottles']({ count: bottles.length })}
                                    </Badge>
                                </button>
                                {#if auth.isAuthenticated}
                                    <button
                                        class="relative z-10 text-muted-foreground hover:text-foreground transition-colors rounded p-1 text-xs h-5 w-5 flex items-center justify-center"
                                        onclick={() => onAddBottle(wine)}
                                        title={m['wines.add_bottle_of_wine']()}
                                        aria-label={m['wines.add_bottle_of_wine']()}
                                    >
                                        <SquarePlus class="h-3 w-3" aria-hidden="true" />
                                    </button>
                                {/if}
                            </div>
                        </div>
                        <div class="mt-1 min-h-[1.5rem] flex items-center">
                            {#if wine.rating}
                                <Badge variant="outline" class="text-xs">
                                    <Star size={14} class="mr-1" />
                                    {formatRating(wine.rating)}
                                </Badge>
                            {:else}
                                <Badge variant="secondary" class="text-xs text-muted-foreground">
                                    <Star size={14} class="mr-1" />
                                    {m['common.no_rating']()}
                                </Badge>
                            {/if}
                        </div>
                    </div>

                    <div class="overflow-hidden flex flex-col justify-start">
                        <div class="text-sm text-muted-foreground flex-shrink-0 mb-1">
                            <div class="truncate">
                                {wine.producer || m['wines.unknown_producer']()}
                            </div>
                            <div class="truncate">
                                {wine.region}, {wine.country}
                            </div>
                        </div>
                        <div class="text-xs flex-shrink-0 my-2">
                            <div class="truncate">
                                <strong
                                    >{m['common.label']({
                                        label: m['common.classification']()
                                    })}</strong
                                >
                                {wine.classification || m['common.not_available']()}
                            </div>
                            <div class="truncate">
                                <strong>{m['common.label']({ label: m['common.price']() })}</strong>
                                {formatPriceRange(priceStats(bottles))}
                            </div>
                            <div class="truncate">
                                <strong
                                    >{m['common.label']({ label: m['common.vintage']() })}</strong
                                >
                                {formatVintageRange(vintageRange(bottles))}
                            </div>
                        </div>
                        <div class="text-xs text-muted-foreground">
                            <div class="line-clamp-1 overflow-hidden">
                                {#if wine.description}
                                    {wine.description}
                                {:else}
                                    <span class="text-muted-foreground"
                                        >{m['wines.no_description_available']()}</span
                                    >
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</div>
