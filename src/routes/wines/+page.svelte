<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import WineListView from '#lib/components/wines/WineListView.svelte';
    import WineDefinitionDialog from '#lib/components/wines/WineDefinitionDialog.svelte';
    import WineBottleDialog from '#lib/components/bottles/WineBottleDialog.svelte';
    import DrinkSoonBanner from '#lib/components/bottles/DrinkSoonBanner.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { SavedDefinitionDTO, WineGroupDTO } from '#lib/shared/dto.js';
    import { invalidate } from '$app/navigation';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { PageData } from './$types';

    type Wine = WineGroupDTO['definition'];

    let { data }: { data: PageData } = $props();

    /** What the wine dialog does: add a wine, or edit or duplicate `wine`. */
    let wineDialog = $state.raw<{ mode: 'add' | 'edit' | 'duplicate'; wine: Wine | null }>({
        mode: 'add',
        wine: null
    });
    let showWineDialog = $state(false);

    // The wine that the bottle dialog adds bottles to; without one, the form asks for it.
    let bottleWineId = $state<string>();
    let showBottleDialog = $state(false);

    function openWineDialog(mode: 'add' | 'edit' | 'duplicate', wine: Wine | null = null) {
        wineDialog = { mode, wine };
        showWineDialog = true;
    }

    function openBottleDialog(wineId?: string) {
        bottleWineId = wineId;
        showBottleDialog = true;
    }

    // Reloads the list, the image URLs for a new image, and the shortage count of the navigation.
    async function wineSaved(wine: SavedDefinitionDTO, addBottle: boolean) {
        await invalidate(CELLAR);
        if (addBottle) openBottleDialog(wine.id);
    }
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.my_wines']())}</title>
    <meta name="description" content={m['wines.subtitle']()} />
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <div class="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
            <h1 class="text-3xl font-bold">{m['wines.title']()}</h1>
            <p class="text-muted-foreground">{m['wines.subtitle']()}</p>
        </div>

        <div class="flex flex-wrap gap-2">
            {#if auth.isAuthenticated}
                <Button onclick={() => openWineDialog('add')}>
                    {m['forms.add_wine']()}
                </Button>
                <Button onclick={() => openBottleDialog()} variant="outline">
                    {m['common.add_bottle']()}
                </Button>
            {:else}
                <Button
                    onclick={() => toasts.add(m['auth.please_login_to_add_wines'](), 'warning')}
                    variant="outline"
                >
                    {m['forms.add_wine']()}
                </Button>
                <Button
                    onclick={() => toasts.add(m['auth.please_login_to_add_bottles'](), 'warning')}
                    variant="outline"
                >
                    {m['common.add_bottle']()}
                </Button>
            {/if}
        </div>
    </div>

    <DrinkSoonBanner bottles={data.toDrink} />

    <WineListView
        wineList={data.wines}
        imageUrls={data.imageUrls}
        onEditWine={(wine) => openWineDialog('edit', wine)}
        onDuplicateWine={(wine) => openWineDialog('duplicate', wine)}
        onAddBottle={(wine) => openBottleDialog(wine.id)}
    />
</div>

<WineDefinitionDialog
    bind:open={showWineDialog}
    editDefinition={wineDialog.wine}
    duplicateMode={wineDialog.mode === 'duplicate'}
    imageUrl={wineDialog.wine?.imageId ? data.imageUrls.get(wineDialog.wine.imageId) : undefined}
    onSaved={wineSaved}
/>

<WineBottleDialog
    bind:open={showBottleDialog}
    selectedDefinitionId={bottleWineId}
    onSaved={() => invalidate(CELLAR)}
/>
