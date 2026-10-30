<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { onMount } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import { BottleWine, TrendingDown, Plus } from '@lucide/svelte';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import { formatPercent, formatPriceRange } from '#lib/utils/format.js';
    import type { WineShortageDTO } from '#lib/shared/dto.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import type { PageData } from './$types';

    type ShortageWine = WineShortageDTO;

    let { data }: { data: PageData } = $props();

    const { shortageData, imageUrls } = $derived(data);

    // The wine that the bottle dialog adds a bottle to
    let showBottleDialog = $state(false);
    let selectedDefinitionId = $state<string | undefined>();

    // Read once at mount: the server renders the images, and a preference changed later in
    // another tab does not apply to a page already open.
    let showImages = $state(true);

    onMount(() => {
        showImages = preferences.showImages;
    });

    // The urgency scale keeps fixed colours in every theme: they tell how short a wine is, and the
    // badge brings its own light background.
    function getShortageColor(shortagePercentage: number) {
        if (shortagePercentage >= 80) return 'text-red-700 bg-red-50 border-red-200';
        if (shortagePercentage >= 50) return 'text-orange-700 bg-orange-50 border-orange-200';
        if (shortagePercentage >= 25) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }

    function getUrgencyLevel(shortagePercentage: number) {
        if (shortagePercentage >= 80) return m['wine_shortage.critical']();
        if (shortagePercentage >= 50) return m['wine_shortage.high']();
        if (shortagePercentage >= 25) return m['wine_shortage.medium']();
        return m['wine_shortage.low']();
    }

    function handleAddBottle(wine: ShortageWine) {
        selectedDefinitionId = wine.id;
        showBottleDialog = true;
    }

    // MIN, MAX and AVG read the same prices: with a minimum, the other two are set too.
    function prices(wine: ShortageWine) {
        return wine.minPrice !== null
            ? { min: wine.minPrice, max: wine.maxPrice!, avg: wine.avgPrice! }
            : null;
    }
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.wine_shortage']())}</title>
    <meta name="description" content={m['wine_shortage.subtitle']()} />
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
                <TrendingDown class="h-8 w-8 text-primary" />
                {m['navigation.wine_shortage']()}
            </h1>
            <p class="text-muted-foreground">{m['wine_shortage.subtitle']()}</p>
        </div>

        {#if shortageData.length > 0}
            <div class="flex items-center gap-4">
                <Badge variant="outline" class="text-destructive border-destructive/30">
                    {m['wine_shortage.wines_need_attention']({ count: shortageData.length })}
                </Badge>
            </div>
        {/if}
    </div>

    {#if shortageData.length === 0}
        <Card>
            <CardContent class="p-8 text-center">
                <div class="flex flex-col items-center space-y-4">
                    <div class="rounded-full bg-success/10 p-4">
                        <BottleWine class="h-8 w-8 text-success" />
                    </div>
                    <div>
                        <h2 class="text-lg font-medium text-success">
                            {m['wine_shortage.all_stocked_up']()}
                        </h2>
                        <p class="text-muted-foreground mt-2">
                            {m['wine_shortage.enough_bottles_message']()}
                        </p>
                        <p class="text-sm text-muted-foreground mt-1">
                            {m['wine_shortage.tip_target_quantities']()}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    {:else}
        <!-- Wine Shortage List -->
        <div class="space-y-4">
            {#each shortageData as wine (wine.id)}
                <Card class="hover:shadow-lg transition-all duration-200">
                    <CardContent class="p-6">
                        <div class="flex items-start justify-between">
                            <!-- Wine Info -->
                            <div class="flex gap-4 flex-1">
                                {#if showImages && wine.imageId && imageUrls.get(wine.imageId)}
                                    <div class="flex-shrink-0">
                                        <a href="/wines/{wine.id}" class="block">
                                            <img
                                                src={imageUrls.get(wine.imageId)}
                                                alt={wine.name}
                                                class="w-16 h-20 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity cursor-pointer"
                                                onerror={(e) =>
                                                    ((e.target as HTMLImageElement).style.display =
                                                        'none')}
                                            />
                                        </a>
                                    </div>
                                {/if}

                                <div class="flex-1 min-w-0">
                                    <div class="flex items-start justify-between mb-2">
                                        <div>
                                            <h2 class="font-semibold text-lg text-foreground">
                                                <a
                                                    href="/wines/{wine.id}"
                                                    class="hover:text-primary-text transition-colors"
                                                >
                                                    {wine.name}
                                                </a>
                                            </h2>
                                            <p class="text-muted-foreground">{wine.producer}</p>
                                            <p class="text-sm text-muted-foreground">
                                                {wine.appellation} • {wine.region} • {wine.country}
                                            </p>
                                            <p class="text-sm text-muted-foreground">
                                                <span class="inline-flex items-center gap-1">
                                                    {#if wine.color}
                                                        <span class="font-medium">{wine.color}</span
                                                        >
                                                    {/if}
                                                    {#if wine.type}
                                                        {#if wine.color}
                                                            •
                                                        {/if}<span class="font-medium"
                                                            >{wine.type}</span
                                                        >
                                                    {/if}
                                                </span>
                                            </p>
                                            <p class="text-sm font-medium text-foreground">
                                                {m['wine_shortage.price']()}
                                                {formatPriceRange(prices(wine))}
                                            </p>
                                        </div>

                                        <!-- Urgency Badge -->
                                        <Badge
                                            class={`${getShortageColor(wine.shortagePercentage)} border font-medium`}
                                        >
                                            {getUrgencyLevel(wine.shortagePercentage)}
                                        </Badge>
                                    </div>

                                    <!-- Shortage Details -->
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                        <!-- Current vs Target -->
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between text-sm">
                                                <span class="text-muted-foreground"
                                                    >{m['wine_shortage.current']()}</span
                                                >
                                                <span class="font-medium"
                                                    >{m['common.n_bottles']({
                                                        count: wine.currentCount
                                                    })}</span
                                                >
                                            </div>
                                            <div class="flex items-center justify-between text-sm">
                                                <span class="text-muted-foreground"
                                                    >{m['wine_shortage.target']()}</span
                                                >
                                                <span class="font-medium"
                                                    >{m['common.n_bottles']({
                                                        count: wine.targetQuantity
                                                    })}</span
                                                >
                                            </div>
                                            <div
                                                class="flex items-center justify-between text-sm border-t pt-2"
                                            >
                                                <span class="text-muted-foreground"
                                                    >{m['wine_shortage.need']()}</span
                                                >
                                                <span class="font-bold text-destructive"
                                                    >+{m['common.n_bottles']({
                                                        count: wine.shortage
                                                    })}</span
                                                >
                                            </div>
                                        </div>

                                        <!-- Progress Bar -->
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between text-sm">
                                                <span class="text-muted-foreground"
                                                    >{m['wine_shortage.progress']()}</span
                                                >
                                                <span class="font-medium"
                                                    >{formatPercent(
                                                        wine.fulfillmentPercentage
                                                    )}</span
                                                >
                                            </div>
                                            <!-- Red to orange, like the urgency scale: how short the wine is -->
                                            <div class="w-full bg-muted rounded-full h-2">
                                                <div
                                                    class="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                                                    style="width: {wine.fulfillmentPercentage}%"
                                                ></div>
                                            </div>
                                            <div class="text-xs text-muted-foreground">
                                                {m['wine_shortage.bottles_short_of_target']({
                                                    count: wine.shortage
                                                })}
                                            </div>
                                        </div>

                                        <!-- Action Button -->
                                        <div class="flex items-end justify-end">
                                            {#if auth.isAuthenticated}
                                                <Button
                                                    onclick={() => handleAddBottle(wine)}
                                                    class="w-full md:w-auto"
                                                >
                                                    <Plus class="h-4 w-4 mr-2" />
                                                    {m['common.add_bottle']()}
                                                </Button>
                                            {:else}
                                                <Button
                                                    onclick={() =>
                                                        toasts.add(
                                                            m['auth.please_login_to_add_bottles'](),
                                                            'warning'
                                                        )}
                                                    variant="outline"
                                                    class="w-full md:w-auto"
                                                >
                                                    <Plus class="h-4 w-4 mr-2" />
                                                    {m['common.add_bottle']()}
                                                </Button>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>

        <!-- Summary Stats -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardContent class="p-6 text-center">
                    <div class="text-2xl font-bold text-destructive">
                        {shortageData.reduce((sum, wine) => sum + wine.shortage, 0)}
                    </div>
                    <div class="text-sm text-muted-foreground">
                        {m['wine_shortage.total_bottles_needed']()}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="p-6 text-center">
                    <div class="text-2xl font-bold text-foreground">{shortageData.length}</div>
                    <div class="text-sm text-muted-foreground">
                        {m['wine_shortage.wines_under_target']()}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="p-6 text-center">
                    {@const avgFulfillment =
                        shortageData.length > 0
                            ? Math.round(
                                  shortageData.reduce(
                                      (sum, wine) => sum + wine.fulfillmentPercentage,
                                      0
                                  ) / shortageData.length
                              )
                            : 0}
                    <div class="text-2xl font-bold text-foreground">
                        {formatPercent(avgFulfillment)}
                    </div>
                    <div class="text-sm text-muted-foreground">
                        {m['wine_shortage.average_fulfillment']()}
                    </div>
                </CardContent>
            </Card>
        </div>
    {/if}
</div>

<!-- Saving refreshes this list and the shortage count of the navigation -->
<WineBottleDialog
    bind:open={showBottleDialog}
    {selectedDefinitionId}
    onSaved={() => invalidate(CELLAR)}
/>
