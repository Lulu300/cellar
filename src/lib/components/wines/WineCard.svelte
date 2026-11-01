<script lang="ts">
    import {
        Award,
        Calendar,
        Coins,
        Copy,
        Image,
        SquarePen,
        SquarePlus,
        Star
    } from '@lucide/svelte';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
    import { Card } from '#lib/components/ui/card/index.js';
    import WishButton from '#lib/components/wishlist/WishButton.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { WineGroupDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { formatPriceRange, formatRating, formatVintageRange } from '#lib/utils/format.js';
    import { colorBadgeClass, typeBadgeClass } from '#lib/utils/wine-badges.js';
    import { priceStats, vintageRange } from '#lib/utils/wine-group-sort.js';
    import ScrollingText from './ScrollingText.svelte';

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

    // Every card has the same size and each field the same place: one line per field, each
    // behind its icon, whose label screen readers and the icon's tooltip give.
    const facts = $derived([
        {
            icon: Award,
            label: m['common.classification'](),
            value: wine.classification || m['common.not_available']()
        },
        {
            icon: Calendar,
            label: m['common.vintage'](),
            value: formatVintageRange(vintageRange(bottles))
        },
        { icon: Coins, label: m['common.price'](), value: formatPriceRange(priceStats(bottles)) }
    ]);

    // Above the link that covers the card
    const iconButton = buttonVariants({
        variant: 'ghost',
        size: 'icon',
        class: 'relative z-10 text-muted-foreground'
    });
</script>

<!-- The link of the title covers the whole card (its ::after); the buttons sit above it,
     since a button inside a link is invalid HTML. -->
<Card
    class="scroll-text-host group/card relative h-full gap-2.5 p-3.5 transition-shadow hover:shadow-lg"
>
    <div class="flex min-w-0 gap-3">
        {#if showImage}
            {#if imageUrl}
                <img
                    src={imageUrl}
                    alt={wine.name}
                    class="h-35 w-25 shrink-0 rounded-md object-cover"
                />
            {:else}
                <div
                    class="flex h-35 w-25 shrink-0 flex-col items-center justify-center gap-1 rounded-md bg-muted p-1 text-center text-[10px] text-muted-foreground"
                >
                    <Image class="size-5" aria-hidden="true" />
                    {m['wine_details.no_image_available']()}
                </div>
            {/if}
        {/if}

        <div class="flex min-w-0 grow flex-col gap-1.5">
            <div>
                <h2 class="text-base/tight font-semibold" title={wine.name}>
                    <!-- Around the text, not inside it: the fade of a cut name would also mask
                         the ::after, and the card would no longer open -->
                    <a
                        href="/wines/{wine.id}"
                        class="block transition-colors after:absolute after:inset-0 after:content-[''] group-hover/card:text-primary-text"
                    >
                        <ScrollingText wrap>{wine.name}</ScrollingText>
                    </a>
                </h2>
                <ScrollingText class="text-sm text-muted-foreground">
                    {wine.producer || m['wines.unknown_producer']()} · {wine.region}, {wine.country}
                </ScrollingText>
            </div>
            <div class="flex gap-1 overflow-hidden">
                <Badge class="{typeBadgeClass(wine.type)} text-xs">{wine.type}</Badge>
                <Badge class="{colorBadgeClass(wine.color)} text-xs">{wine.color}</Badge>
                {#if wine.rating}
                    <Badge variant="outline" class="text-xs">
                        <Star size={14} />
                        {formatRating(wine.rating)}
                    </Badge>
                {:else}
                    <Badge variant="secondary" class="text-xs text-muted-foreground">
                        <Star size={14} />
                        {m['common.no_rating']()}
                    </Badge>
                {/if}
            </div>
            <dl
                class="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-t pt-1.5 text-sm"
            >
                {#each facts as { icon: Icon, label, value } (label)}
                    <!-- Above the card's link, so that the icon shows its tooltip -->
                    <dt class="relative z-10 text-muted-foreground" title={label}>
                        <span class="sr-only">{label}</span>
                        <Icon class="size-4" aria-hidden="true" />
                    </dt>
                    <dd class="font-semibold">
                        <ScrollingText>{value}</ScrollingText>
                    </dd>
                {/each}
            </dl>
        </div>
    </div>

    <!-- Two lines, always: a short description or none keeps the bar below in its place -->
    <p class="line-clamp-2 h-8 text-xs/4 {wine.description ? '' : 'text-muted-foreground'}">
        {wine.description || m['wines.no_description_available']()}
    </p>

    <div class="mt-auto flex items-center gap-1 border-t pt-2">
        <Button
            variant="secondary"
            class="relative z-10"
            onclick={() => onShowBottles(wine)}
            title={m['wines.view_bottle_details']()}
        >
            {m['common.n_bottles']({ count: bottles.length })}
        </Button>
        {#if auth.isAuthenticated}
            <button
                type="button"
                class={iconButton}
                onclick={() => onAddBottle(wine)}
                title={m['wines.add_bottle_of_wine']()}
                aria-label={m['wines.add_bottle_of_wine']()}
            >
                <SquarePlus aria-hidden="true" />
            </button>
            <WishButton wineId={wine.id} class="ml-auto {iconButton}" />
            <button
                type="button"
                class={iconButton}
                onclick={() => onEdit(wine)}
                title={m['forms.edit_wine']()}
                aria-label={m['forms.edit_wine']()}
            >
                <SquarePen aria-hidden="true" />
            </button>
            <button
                type="button"
                class={iconButton}
                onclick={() => onDuplicate(wine)}
                title={m['forms.duplicate_wine']()}
                aria-label={m['forms.duplicate_wine']()}
            >
                <Copy aria-hidden="true" />
            </button>
        {/if}
    </div>
</Card>
