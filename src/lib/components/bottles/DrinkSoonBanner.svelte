<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { invalidate } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import { ChevronDown, Clock, MapPin } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { SOON } from '#lib/shared/drinking.js';
    import type { BottleToDrinkDTO } from '#lib/shared/dto.js';
    import { cn } from '#lib/utils.js';
    import { bottleName } from './bottle-table.js';
    import { BottleDialogs } from './bottle-dialogs.svelte.js';
    import BottleChangeDialogs from './BottleChangeDialogs.svelte';
    import BottleRowMenu from './BottleRowMenu.svelte';
    import DrinkingChip from './DrinkingChip.svelte';
    import DrinkingMark from './DrinkingMark.svelte';
    import { drinkingText, rankLabel } from './drinking.js';
    import WineBottleDialog from './WineBottleDialog.svelte';

    /**
     * The banner of the wine list: how many bottles to drink soon, by rank, which unfolds their
     * list, each with its menu. Hidden when there is none.
     */
    let { bottles }: { bottles: BottleToDrinkDTO[] } = $props();

    let open = $state(false);
    const groups = $derived(
        SOON.map((rank) => ({
            rank,
            bottles: bottles.filter((bottle) => bottle.rank === rank)
        })).filter((group) => group.bottles.length > 0)
    );

    // A change of status, place or date changes the list and the wine cards behind it.
    const dialogs = new BottleDialogs<BottleToDrinkDTO>(new SvelteSet(), () => invalidate(CELLAR));
    let editingBottle = $state<ComponentProps<typeof WineBottleDialog>['editBottle']>(null);
    let showEditDialog = $state(false);

    const id = $props.id();
</script>

{#if bottles.length > 0}
    <Card class="mb-6 gap-0 py-4">
        <CardHeader class="flex flex-wrap items-center gap-x-4 gap-y-3 px-4">
            <CardTitle class="flex items-center gap-2 text-base">
                <Clock class="h-4 w-4 text-primary-text" aria-hidden="true" />
                {m['drinking.soon_title']()}
            </CardTitle>
            <ul class="flex flex-wrap items-center gap-1.5" aria-label={m['drinking.by_rank']()}>
                {#each groups as group (group.rank)}
                    <li><DrinkingChip rank={group.rank} count={group.bottles.length} /></li>
                {/each}
            </ul>
            <Button
                variant="outline"
                size="sm"
                class="ml-auto"
                aria-expanded={open}
                aria-controls="{id}-list"
                onclick={() => (open = !open)}
            >
                {open ? m['drinking.hide_list']() : m['drinking.show_list']()}
                <ChevronDown
                    class={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                />
            </Button>
        </CardHeader>
        {#if open}
            <CardContent id="{id}-list" class="mt-3 space-y-3 border-t px-4 pt-3">
                {#each groups as group (group.rank)}
                    <section aria-labelledby="{id}-{group.rank}">
                        <h3
                            id="{id}-{group.rank}"
                            class={cn(
                                'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
                                group.rank === 'late' ? 'text-destructive' : 'text-muted-foreground'
                            )}
                        >
                            <DrinkingMark rank={group.rank} size={11} />
                            {rankLabel(group.rank)} · {group.bottles.length}
                        </h3>
                        <ul class="divide-y">
                            {#each group.bottles as bottle (bottle.id)}
                                <li class="flex items-center gap-2 py-1.5">
                                    <div
                                        class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_10rem]"
                                    >
                                        <a
                                            href="/wines/{bottle.definition.id}"
                                            class="min-w-0 basis-full font-medium hover:underline hover:text-primary-text sm:basis-auto sm:truncate"
                                            title={m['wine_details.view_wine_page']()}
                                        >
                                            {bottle.definition.name}
                                            {#if bottle.vintage}
                                                <span class="font-normal text-muted-foreground">
                                                    {bottle.vintage}
                                                </span>
                                            {/if}
                                        </a>
                                        <span
                                            class="inline-flex items-center gap-1 text-sm text-muted-foreground"
                                        >
                                            <MapPin class="h-3.5 w-3.5" aria-hidden="true" />
                                            <span class="sr-only">{m['common.location']()}</span>
                                            {bottle.storageCase?.name ??
                                                m['common.not_available']()}
                                        </span>
                                        <span class="text-sm text-muted-foreground">
                                            {drinkingText(bottle)}
                                        </span>
                                    </div>
                                    <BottleRowMenu
                                        {bottle}
                                        {dialogs}
                                        onEdit={(bottle) => {
                                            editingBottle = bottle;
                                            showEditDialog = true;
                                        }}
                                    />
                                </li>
                            {/each}
                        </ul>
                    </section>
                {/each}
            </CardContent>
        {/if}
    </Card>
{/if}

<BottleChangeDialogs {dialogs}>
    {#snippet children([bottle])}
        <p class="text-sm text-muted-foreground">{bottleName(bottle)}</p>
    {/snippet}
</BottleChangeDialogs>

<WineBottleDialog bind:open={showEditDialog} editBottle={editingBottle} onSaved={dialogs.saved} />
