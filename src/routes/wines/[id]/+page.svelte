<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { invalidate } from '$app/navigation';
    import type { PageData } from './$types';
    import { m } from '#lib/paraglide/messages.js';
    import { formatRating, formatVintageRange } from '#lib/utils/format.js';
    import { safeUrl } from '#lib/utils/url.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { MapPin, SquarePen } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import WineDefinitionDialog from '#lib/components/wines/WineDefinitionDialog.svelte';
    import WinePhotos from '#lib/components/wines/WinePhotos.svelte';
    import RemoveTargetButton from '#lib/components/wines/RemoveTargetButton.svelte';
    import WishButton from '#lib/components/wishlist/WishButton.svelte';
    import BarcodeDialog from '#lib/components/barcode/BarcodeDialog.svelte';
    import BottleCard from '#lib/components/bottles/BottleCard.svelte';
    import BottleStatusDialog from '#lib/components/bottles/BottleStatusDialog.svelte';
    import BackButton from '#lib/components/layout/BackButton.svelte';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import type { BottleWithDefinitionDTO } from '#lib/shared/dto.js';
    import { typeBadgeClass } from '#lib/utils/wine-badges.js';
    import WineColorBadge from '#lib/components/wines/WineColorBadge.svelte';
    import { storageLocations } from '#lib/components/wines/wine-facts.js';
    import { ownedBottles, vintageRange } from '#lib/utils/wine-group-sort.js';
    import { sortBottles } from '#lib/utils/bottle-sort.js';
    import { iconButton } from '#lib/components/layout/button-states.js';
    import { cn } from '#lib/utils.js';

    type Bottle = BottleWithDefinitionDTO;

    let { data }: { data: PageData } = $props();

    const { wineDefinition, bottles, photos, inShortage } = $derived(data);

    // The bottles below are replaced, never mutated: raw state does not proxy the objects of `data`.

    /** What the bottle dialog does: add a bottle to this wine, or edit or duplicate `bottle`. */
    let bottleDialog = $state.raw<{ mode: 'add' | 'edit' | 'duplicate'; bottle: Bottle | null }>({
        mode: 'add',
        bottle: null
    });
    let showBottleDialog = $state(false);

    // Edit definition state
    let showEditDefinitionDialog = $state(false);

    // Barcode dialog state
    let showBarcodeDialog = $state(false);
    let selectedBarcode = $state('');

    // Bottles section state
    let showAvailableBottles = $state(true); // Default to shown
    let showConsumedBottles = $state(false);

    // The bottle whose status changes, while its dialog is open
    let statusBottle = $state.raw<Bottle | null>(null);

    // Separate bottles by availability status
    const availableBottles = $derived(ownedBottles(bottles));
    const consumedBottles = $derived(
        sortBottles(
            bottles.filter((bottle) => bottle.availability === BottleAvailability.CONSUMED),
            { column: 'consumedDate', direction: 'desc' }
        )
    );

    const vintages = $derived(vintageRange(availableBottles));

    const locations = $derived(storageLocations(bottles));

    // The storage page has cases to highlight only for a bottle in the cellar, in a case: one out
    // of the cellar keeps its case without being in it.
    const inACase = $derived(
        bottles.some(
            (bottle) => bottle.availability === BottleAvailability.AVAILABLE && bottle.storageCase
        )
    );

    function openBottleDialog(mode: 'add' | 'edit' | 'duplicate', bottle: Bottle | null = null) {
        bottleDialog = { mode, bottle };
        showBottleDialog = true;
    }

    // Deleted elsewhere: nothing left to change
    async function forgetStatusBottle() {
        statusBottle = null;
        await invalidate(CELLAR);
    }

    const headerButton = cn(iconButton, 'size-10');

    function showBarcode(wine: Bottle) {
        if (wine.barcode) {
            selectedBarcode = wine.barcode;
            showBarcodeDialog = true;
        }
    }
</script>

<svelte:head>
    <title>{pageTitle(wineDefinition.name)}</title>
    <meta name="description" content={m['wine_details.meta_description']()} />
</svelte:head>

{#snippet card(bottle: Bottle)}
    <BottleCard
        {bottle}
        onStatus={(chosen) => (statusBottle = chosen)}
        onDuplicate={(chosen) => openBottleDialog('duplicate', chosen)}
        onEdit={(chosen) => openBottleDialog('edit', chosen)}
        onBarcode={showBarcode}
    />
{/snippet}

<div class="mb-6">
    <BackButton />
</div>

<div class="space-y-6">
    <!-- Wine Definition Details -->
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <h1>{wineDefinition.name}</h1>
                <Badge class={typeBadgeClass(wineDefinition.type)}>
                    {wineDefinition.type}
                </Badge>
                <WineColorBadge name={wineDefinition.color} hex={wineDefinition.colorHex} />
                <!-- Edit Button -->
                {#if auth.isAuthenticated}
                    <div class="ml-auto flex">
                        <WishButton
                            wineId={wineDefinition.id}
                            class={headerButton}
                            iconClass="size-6"
                        />
                        <button
                            class={headerButton}
                            onclick={() => (showEditDefinitionDialog = true)}
                            title={m['forms.edit_wine']()}
                            aria-label={m['forms.edit_wine']()}
                        >
                            <SquarePen class="size-6" aria-hidden="true" />
                        </button>
                    </div>
                {/if}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div>
                        <h2 class="font-semibold mb-2">
                            {m['wine_details.wine_information']()}
                        </h2>
                        <div class="space-y-2 text-sm">
                            <div>
                                <strong
                                    >{m['common.label']({
                                        label: m['common.producer']()
                                    })}</strong
                                >
                                {wineDefinition.producer}
                            </div>
                            {#if vintages}
                                <div>
                                    <strong
                                        >{m['common.label']({
                                            label: m['common.vintage']()
                                        })}</strong
                                    >
                                    {formatVintageRange(vintages)}
                                </div>
                            {/if}
                            <div>
                                <strong
                                    >{m['common.label']({
                                        label: m['common.region']()
                                    })}</strong
                                >
                                {wineDefinition.appellation.region.name}
                            </div>
                            <div>
                                <strong
                                    >{m['common.label']({
                                        label: m['common.appellation']()
                                    })}</strong
                                >
                                {wineDefinition.appellation.name}
                            </div>
                            <div>
                                <strong
                                    >{m['common.label']({
                                        label: m['common.country']()
                                    })}</strong
                                >
                                {wineDefinition.appellation.region.country.name}
                            </div>
                            {#if wineDefinition.rating}
                                <div>
                                    <strong
                                        >{m['common.label']({
                                            label: m['wine_details.rating']()
                                        })}</strong
                                    >
                                    {formatRating(wineDefinition.rating)}
                                </div>
                            {/if}
                            {#if wineDefinition.classification}
                                <div>
                                    <strong
                                        >{m['common.label']({
                                            label: m['common.classification']()
                                        })}</strong
                                    >
                                    {wineDefinition.classification}
                                </div>
                            {/if}
                            {#if inShortage && wineDefinition.targetQuantity !== null}
                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>
                                        <strong
                                            >{m['common.label']({
                                                label: m['forms.target_quantity']()
                                            })}</strong
                                        >
                                        {m['common.n_bottles']({
                                            count: wineDefinition.targetQuantity
                                        })}
                                    </span>
                                    {#if auth.isAuthenticated}
                                        <RemoveTargetButton wine={wineDefinition} size="sm" />
                                    {/if}
                                </div>
                            {/if}
                            {#if wineDefinition.website}
                                {@const websiteUrl = safeUrl(wineDefinition.website)}
                                <div>
                                    <strong
                                        >{m['common.label']({
                                            label: m['common.website']()
                                        })}</strong
                                    >
                                    {#if websiteUrl}
                                        <a
                                            href={websiteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="text-foreground underline underline-offset-4 hover:text-primary-text"
                                            >{wineDefinition.website}</a
                                        >
                                    {:else}
                                        <span>{wineDefinition.website}</span>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                    {#if wineDefinition.description}
                        <div>
                            <h2 class="font-semibold mb-2">
                                {m['common.description']()}
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                {wineDefinition.description}
                            </p>
                        </div>
                    {/if}
                    {#if wineDefinition.grapeVarieties && wineDefinition.grapeVarieties.length > 0}
                        <div>
                            <h2 class="font-semibold mb-2">
                                {m['wine_details.grape_varieties']()}
                            </h2>
                            <div class="flex gap-1 flex-wrap">
                                <!-- Nothing stops a grape from being listed twice: its position is the key. -->
                                {#each wineDefinition.grapeVarieties as variety, index (index)}
                                    <Badge variant="outline">{variety}</Badge>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
                <div class="flex justify-center">
                    <WinePhotos
                        wineId={wineDefinition.id}
                        wineName={wineDefinition.name}
                        {photos}
                    />
                </div>
            </div>
        </CardContent>
    </Card>

    <!-- Storage Locations -->
    {#if Object.keys(locations).length > 0}
        <div class="bg-muted/20 rounded-lg p-3 border">
            <div class="flex flex-wrap items-center gap-2 mb-2">
                <MapPin class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm font-medium">{m['wine_details.storage_locations']()}</span>
                {#if inACase}
                    <Button
                        href="/storage?wine={encodeURIComponent(wineDefinition.id)}"
                        size="sm"
                        variant="outline"
                        class="ml-auto"
                    >
                        <MapPin class="h-4 w-4" aria-hidden="true" />
                        {m['wine_details.show_in_cellar']()}
                    </Button>
                {/if}
            </div>
            <div class="flex flex-wrap gap-2">
                {#each Object.entries(locations) as [location, count] (location)}
                    <Badge variant="outline" class="text-xs">
                        {location} ({count})
                    </Badge>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Bottles Grid -->
    <Card>
        <CardHeader>
            <CardTitle class="flex flex-wrap items-center justify-between gap-2">
                <span>{m['common.available_bottles']()} ({availableBottles.length})</span>
                <div class="flex flex-wrap gap-2 ml-auto">
                    {#if auth.isAuthenticated}
                        <Button
                            size="sm"
                            variant="secondary"
                            onclick={() => openBottleDialog('add')}
                        >
                            {m['wine_details.add_bottle']()}
                        </Button>
                    {/if}
                    <Button
                        size="sm"
                        variant="outline"
                        onclick={() => (showAvailableBottles = !showAvailableBottles)}
                    >
                        {showAvailableBottles
                            ? m['wine_details.hide_available']()
                            : m['wine_details.show_available']()}
                    </Button>
                </div>
            </CardTitle>
        </CardHeader>
        {#if showAvailableBottles}
            <CardContent>
                {#if availableBottles.length > 0}
                    <div
                        class="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-4"
                    >
                        {#each availableBottles as bottle (bottle.id)}
                            {@render card(bottle)}
                        {/each}
                    </div>
                {:else}
                    <p class="text-muted-foreground text-center py-8">
                        {m['wine_details.no_available_bottles']()}
                    </p>
                {/if}
            </CardContent>
        {/if}
    </Card>

    <!-- Consumed Bottles Section -->
    <Card>
        <CardHeader>
            <CardTitle class="flex flex-wrap items-center justify-between gap-2">
                <span>{m['wine_details.consumed_bottles']()} ({consumedBottles.length})</span>
                <Button
                    size="sm"
                    variant="outline"
                    onclick={() => (showConsumedBottles = !showConsumedBottles)}
                    class="ml-auto"
                >
                    {showConsumedBottles
                        ? m['wine_details.hide_consumed']()
                        : m['wine_details.show_consumed']()}
                </Button>
            </CardTitle>
        </CardHeader>
        {#if showConsumedBottles}
            <CardContent>
                {#if consumedBottles.length > 0}
                    <div
                        class="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-4"
                    >
                        {#each consumedBottles as bottle (bottle.id)}
                            {@render card(bottle)}
                        {/each}
                    </div>
                {:else}
                    <p class="text-muted-foreground text-center py-8">
                        {m['wine_details.no_consumed_bottles']()}
                    </p>
                {/if}
            </CardContent>
        {/if}
    </Card>
</div>

<!-- Edit Wine Definition Dialog: saving reloads the photos too, for a new main one -->
<WineDefinitionDialog
    bind:open={showEditDefinitionDialog}
    editDefinition={wineDefinition}
    imageUrl={photos.find((photo) => photo.main)?.url}
    onSaved={() => invalidate(CELLAR)}
/>

<WineBottleDialog
    bind:open={showBottleDialog}
    selectedDefinitionId={wineDefinition.id}
    editBottle={bottleDialog.bottle}
    duplicateMode={bottleDialog.mode === 'duplicate'}
    onSaved={() => invalidate(CELLAR)}
/>

<!-- Barcode Dialog -->
<BarcodeDialog
    bind:open={showBarcodeDialog}
    barcodeValue={selectedBarcode}
    onClose={() => (showBarcodeDialog = false)}
/>

{#if statusBottle}
    <BottleStatusDialog
        bottles={[statusBottle]}
        onClose={() => (statusBottle = null)}
        onSaved={() => invalidate(CELLAR)}
        onMissing={forgetStatusBottle}
    />
{/if}
