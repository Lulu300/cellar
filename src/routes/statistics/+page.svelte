<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { TrendingUp, DollarSign, BottleWine, ChartColumn } from '@lucide/svelte';
    import BarChart from '#lib/components/statistics/BarChart.svelte';
    import PieChart from '#lib/components/statistics/PieChart.svelte';
    import { colorFill, typeFill } from '#lib/utils/wine-badges.js';
    import { m } from '#lib/paraglide/messages.js';
    import { formatCurrency } from '#lib/utils/format.js';
    import { nameIsShared } from '#lib/utils/compare.js';
    import { availabilityLabel } from '#lib/components/bottles/availability.js';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    const statsData = $derived(data.statsData);

    // The vintages of the last ten years, at most ten of them
    const recentVintages = $derived.by(() => {
        const currentYear = new Date().getFullYear();
        return statsData.winesByVintage
            .filter((vintage) => vintage.vintage >= currentYear - 10)
            .slice(-10);
    });

    // Neutral colors for pie charts
    const neutralColors = [
        '#64748b', // slate-500
        '#6b7280', // gray-500
        '#71717a', // zinc-500
        '#737373', // neutral-500
        '#78716c', // stone-500
        '#94a3b8', // slate-400
        '#9ca3af', // gray-400
        '#a1a1aa', // zinc-400
        '#a3a3a3', // neutral-400
        '#a8a29e' // stone-400
    ];

    function neutralColor(index: number): string {
        return neutralColors[index % neutralColors.length];
    }
</script>

<svelte:head>
    <title>{pageTitle(m['statistics.title']())}</title>
    <meta name="description" content={m['statistics.subtitle']()} />
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
                <ChartColumn class="h-8 w-8 text-primary" />
                {m['statistics.title']()}
            </h1>
            <p class="text-muted-foreground">{m['statistics.subtitle']()}</p>
        </div>
    </div>

    <!-- Key Metrics Summary -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
            <CardContent class="p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            {m['statistics.total_value_purchase']()}
                        </p>
                        <p class="text-2xl font-bold">
                            {formatCurrency(statsData.valueStats?.totalPurchaseValue || 0, {
                                wholeEuros: true
                            })}
                        </p>
                    </div>
                    <DollarSign class="h-8 w-8 text-primary" />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardContent class="p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            {m['statistics.total_value_current']()}
                        </p>
                        <p class="text-2xl font-bold">
                            {formatCurrency(statsData.valueStats?.totalHybridValue || 0, {
                                wholeEuros: true
                            })}
                        </p>
                    </div>
                    <TrendingUp class="h-8 w-8 text-primary" />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardContent class="p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            {m['common.available_bottles']()}
                        </p>
                        <p class="text-2xl font-bold">
                            {statsData.totalStats?.totalBottles || 0}
                        </p>
                    </div>
                    <BottleWine class="h-8 w-8 text-primary" />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardContent class="p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            {m['common.wines']()}
                        </p>
                        <p class="text-2xl font-bold">
                            {statsData.totalStats?.totalDefinitions || 0}
                        </p>
                    </div>
                    <ChartColumn class="h-8 w-8 text-primary" />
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- Value Details -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.value_breakdown']()}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium"
                            >{m['statistics.total_purchase_value']()}</span
                        >
                        <span class="font-bold text-foreground"
                            >{formatCurrency(statsData.valueStats?.totalPurchaseValue || 0)}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium"
                            >{m['statistics.total_current_value']()}</span
                        >
                        <span class="font-bold text-foreground"
                            >{formatCurrency(statsData.valueStats?.totalCurrentValue || 0)}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium">{m['statistics.hybrid_value']()}</span>
                        <span class="font-bold text-foreground"
                            >{formatCurrency(statsData.valueStats?.totalHybridValue || 0)}</span
                        >
                    </div>
                    <hr class="my-3" />
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium"
                            >{m['statistics.avg_purchase_price']()}</span
                        >
                        <span class="font-semibold"
                            >{formatCurrency(statsData.valueStats?.avgPurchasePrice)}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium"
                            >{m['statistics.avg_current_value']()}</span
                        >
                        <span class="font-semibold"
                            >{formatCurrency(statsData.valueStats?.avgCurrentValue)}</span
                        >
                    </div>
                </div>
                <p class="text-xs text-muted-foreground mt-4">
                    {m['statistics.hybrid_value_note']()}
                </p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.bottle_status']()}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    {#each statsData.bottlesByAvailability || [] as status (status.availability)}
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium"
                                >{availabilityLabel(status.availability)}</span
                            >
                            <span class="font-bold"
                                >{m['common.n_bottles']({ count: status.count })}</span
                            >
                        </div>
                    {/each}
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- Distribution Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Wine Types Chart -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.distribution_by_type']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if statsData.winesByType?.length > 0}
                    <div class="flex flex-col items-center space-y-6">
                        <!-- Pie Chart -->
                        <div class="aspect-square max-h-[250px] relative">
                            <PieChart
                                slices={statsData.winesByType.map((type) => ({
                                    count: type.count,
                                    color: typeFill(type.type)
                                }))}
                            />
                        </div>

                        <!-- Legend -->
                        <div class="flex flex-wrap justify-center gap-4">
                            {#each statsData.winesByType as type (type.type)}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="w-4 h-4 rounded-sm"
                                        style="background-color: {typeFill(type.type)}"
                                    ></div>
                                    <span class="text-sm font-medium">{type.type}</span>
                                    <span class="text-sm text-muted-foreground">({type.count})</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_data_available']()}
                    </p>
                {/if}
            </CardContent>
        </Card>

        <!-- Wine Colors Chart -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.distribution_by_color']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if statsData.winesByColor?.length > 0}
                    <div class="flex flex-col items-center space-y-6">
                        <!-- Pie Chart -->
                        <div class="aspect-square max-h-[250px] relative">
                            <PieChart
                                slices={statsData.winesByColor.map((color) => ({
                                    count: color.count,
                                    color: colorFill(color.color)
                                }))}
                            />
                        </div>

                        <!-- Legend -->
                        <div class="flex flex-wrap justify-center gap-4">
                            {#each statsData.winesByColor as color (color.color)}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="w-4 h-4 rounded-sm"
                                        style="background-color: {colorFill(color.color)}"
                                    ></div>
                                    <span class="text-sm font-medium">{color.color}</span>
                                    <span class="text-sm text-muted-foreground"
                                        >({color.count})</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_data_available']()}
                    </p>
                {/if}
            </CardContent>
        </Card>
    </div>

    <!-- Geographic and Producer Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Countries Chart -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.top_countries']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if statsData.winesByCountry?.length > 0}
                    <BarChart
                        bars={statsData.winesByCountry.map(({ country, count }) => ({
                            key: country,
                            name: country,
                            count
                        }))}
                    />
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_data_available']()}
                    </p>
                {/if}
            </CardContent>
        </Card>

        <!-- Top Producers -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.top_producers']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if statsData.topProducers?.length > 0}
                    <BarChart
                        bars={statsData.topProducers.map(({ producer, count }) => ({
                            key: producer,
                            name: producer,
                            count
                        }))}
                    />
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_producer_data']()}
                    </p>
                {/if}
            </CardContent>
        </Card>
    </div>

    <!-- Vintage and Age Analysis -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Wine Age by Decades -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.wine_age_by_decades']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if statsData.winesByDecade?.length > 0}
                    <div class="flex flex-col items-center space-y-6">
                        <!-- Pie Chart -->
                        <div class="aspect-square max-h-[250px] relative">
                            <PieChart
                                slices={statsData.winesByDecade.map((decade, index) => ({
                                    count: decade.count,
                                    color: neutralColor(index)
                                }))}
                            />
                        </div>

                        <!-- Legend -->
                        <div class="flex flex-wrap justify-center gap-4">
                            {#each statsData.winesByDecade as decade, index (decade.decade)}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="w-4 h-4 rounded-sm"
                                        style="background-color: {neutralColor(index)}"
                                    ></div>
                                    <span class="text-sm font-medium"
                                        >{m['statistics.decade']({ decade: decade.decade })}</span
                                    >
                                    <span class="text-sm text-muted-foreground"
                                        >({decade.count})</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_decade_data']()}
                    </p>
                {/if}
            </CardContent>
        </Card>

        <!-- Recent Vintages -->
        <Card>
            <CardHeader>
                <CardTitle>{m['statistics.recent_vintages']()}</CardTitle>
            </CardHeader>
            <CardContent>
                {#if recentVintages.length > 0}
                    <BarChart
                        bars={recentVintages.map(({ vintage, count }) => ({
                            key: vintage,
                            name: String(vintage),
                            // Unlike a name, a year cut by "…" says nothing ("2…" under every
                            // bar of a phone): two digits always fit, and read at a glance.
                            short: `’${String(vintage).slice(-2)}`,
                            count
                        }))}
                    />
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {m['statistics.no_vintage_data']()}
                    </p>
                {/if}
            </CardContent>
        </Card>
    </div>

    <!-- Regional Breakdown -->
    {#if statsData.winesByRegion?.length > 0}
        <Card class="mt-6">
            <CardHeader>
                <CardTitle>{m['statistics.top_wine_regions']()}</CardTitle>
            </CardHeader>
            <CardContent>
                <!-- A region's country shows when another region has its name. -->
                <BarChart
                    bars={statsData.winesByRegion.map((region) => ({
                        key: region.id,
                        name: region.region,
                        detail: nameIsShared(statsData.winesByRegion, region, (row) => row.region)
                            ? region.country
                            : undefined,
                        count: region.count
                    }))}
                />
            </CardContent>
        </Card>
    {/if}
</div>
