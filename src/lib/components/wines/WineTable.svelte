<script lang="ts">
    import {
        Bookmark,
        Copy,
        EllipsisVertical,
        ImageIcon,
        SquarePen,
        SquarePlus,
        Wine as WineIcon
    } from '@lucide/svelte';
    import { page } from '$app/state';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card } from '#lib/components/ui/card/index.js';
    import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
    import * as Table from '#lib/components/ui/table/index.js';
    import WishButton from '#lib/components/wishlist/WishButton.svelte';
    import { toggleWish } from '#lib/components/wishlist/wishes.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { WineGroupDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import WineColorBadge from './WineColorBadge.svelte';
    import { wineFacts } from './wine-facts.js';
    import { iconButton } from './wine-list.js';

    type Wine = WineGroupDTO['definition'];

    /**
     * The wines of the list, one row each: a table on a computer, a list on a phone. Nothing is
     * cut: a long text wraps and its row grows. The name of a wine opens it from anywhere on its
     * row, as on its card; the buttons sit above that link.
     */
    let {
        wines,
        imageUrl,
        showImages,
        onEdit,
        onDuplicate,
        onAddBottle,
        onShowBottles
    }: {
        /** The wines with their bottles still owned, filtered and sorted. */
        wines: WineGroupDTO[];
        imageUrl: (wine: Wine) => string | undefined;
        showImages: boolean;
        onEdit: (wine: Wine) => void;
        onDuplicate: (wine: Wine) => void;
        onAddBottle: (wine: Wine) => void;
        onShowBottles: (wine: Wine) => void;
    } = $props();

    const rows = $derived(
        wines.map((group) => ({ wine: group.definition, facts: wineFacts(group) }))
    );
    // Loaded by the root layout, and reloaded after each change
    const wishedWines: Record<string, string> = $derived(page.data.wishedWines ?? {});

    // Its ::after covers the row, which must be positioned: a click anywhere opens the wine.
    const nameLink =
        "font-semibold transition-colors after:absolute after:inset-0 after:content-[''] group-hover/row:text-primary-text";
    // The ui table keeps each cell on one line; here, a long text wraps instead.
    const wrapping = 'whitespace-normal [overflow-wrap:anywhere]';
</script>

{#snippet thumbnail(wine: Wine)}
    {@const url = imageUrl(wine)}
    <!-- The name follows: the image adds nothing for a screen reader -->
    {#if url}
        <img src={url} alt="" class="h-13 w-10 shrink-0 rounded-md object-cover" />
    {:else}
        <div
            class="flex h-13 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
            <ImageIcon class="size-4" aria-hidden="true" />
        </div>
    {/if}
{/snippet}

<!-- A long colour wraps inside its badge, which otherwise keeps its text on one line. In the
     table, its name is at most 6rem wide: a long word breaks there rather than widen the column,
     and a shorter one stays whole. On a phone, the row bounds the badge. -->
{#snippet colorBadge(wine: Wine, className: string, nameClass = '')}
    <WineColorBadge
        name={wine.color}
        hex={wine.colorHex}
        class={[className, 'text-xs whitespace-normal']}
    >
        <span class={nameClass}>{wine.color}</span>
    </WineColorBadge>
{/snippet}

<!-- On a phone, the menu holds every action of the row; on a computer, the row shows the bottles,
     the bookmark and add a bottle, and the menu holds the rest. -->
{#snippet actions(wine: Wine, everything: boolean)}
    <DropdownMenu.Root>
        <DropdownMenu.Trigger
            class={iconButton}
            title={m['wines.more_actions']()}
            aria-label={m['wines.more_actions']()}
        >
            <EllipsisVertical aria-hidden="true" />
        </DropdownMenu.Trigger>
        <!-- The item it focuses shows where the keyboard is: the menu itself needs no outline -->
        <DropdownMenu.Content align="end" class="w-auto outline-none">
            {#if everything}
                <DropdownMenu.Item onSelect={() => onShowBottles(wine)}>
                    <WineIcon aria-hidden="true" />
                    {m['wines.view_bottle_details']()}
                </DropdownMenu.Item>
            {/if}
            {#if auth.isAuthenticated}
                {#if everything}
                    {@const wishId = wishedWines[wine.id]}
                    <DropdownMenu.Item onSelect={() => onAddBottle(wine)}>
                        <SquarePlus aria-hidden="true" />
                        {m['wines.add_bottle_of_wine']()}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => toggleWish(wine.id, wishId)}>
                        <Bookmark
                            class={wishId ? 'fill-current text-primary-text' : ''}
                            aria-hidden="true"
                        />
                        {wishId
                            ? m['wishlist.remove_from_wishlist']()
                            : m['wishlist.add_to_wishlist']()}
                    </DropdownMenu.Item>
                {/if}
                <DropdownMenu.Item onSelect={() => onEdit(wine)}>
                    <SquarePen aria-hidden="true" />
                    {m['forms.edit_wine']()}
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => onDuplicate(wine)}>
                    <Copy aria-hidden="true" />
                    {m['forms.duplicate_wine']()}
                </DropdownMenu.Item>
            {/if}
        </DropdownMenu.Content>
    </DropdownMenu.Root>
{/snippet}

<Card class="hidden gap-0 py-0 lg:flex">
    <Table.Root>
        <Table.Header>
            <Table.Row class="hover:bg-transparent">
                <!-- The texts that wrap keep their share of a narrow table, which the short values
                     would otherwise take -->
                <Table.Head class="w-[36%] ps-4">{m['common.wine']()}</Table.Head>
                <Table.Head class="w-[16%]">{m['common.region']()}</Table.Head>
                <Table.Head>{m['common.color']()}</Table.Head>
                <Table.Head>{m['common.vintage']()}</Table.Head>
                <Table.Head>{m['common.price']()}</Table.Head>
                <Table.Head>{m['wines.bottles']()}</Table.Head>
                <Table.Head>{m['wine_details.rating']()}</Table.Head>
                {#if auth.isAuthenticated}
                    <Table.Head class="pe-4">
                        <span class="sr-only">{m['common.actions']()}</span>
                    </Table.Head>
                {/if}
            </Table.Row>
        </Table.Header>
        <Table.Body>
            {#each rows as { wine, facts } (wine.id)}
                <Table.Row class="group/row relative">
                    <Table.Cell class="ps-4 py-2.5 {wrapping}">
                        <div class="flex items-center gap-3">
                            {#if showImages}
                                {@render thumbnail(wine)}
                            {/if}
                            <div>
                                <a href="/wines/{wine.id}" class={nameLink}>{wine.name}</a>
                                <p class="mt-0.5 text-xs text-muted-foreground">
                                    {facts.producer}{wine.classification
                                        ? ` · ${wine.classification}`
                                        : ''}
                                </p>
                            </div>
                        </div>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground {wrapping}">{facts.place}</Table.Cell>
                    <Table.Cell>
                        {@render colorBadge(wine, '', 'max-w-24 [overflow-wrap:break-word]')}
                    </Table.Cell>
                    <Table.Cell>{facts.vintage}</Table.Cell>
                    <Table.Cell class="whitespace-normal">{facts.price}</Table.Cell>
                    <Table.Cell>
                        <Button
                            variant="secondary"
                            size="sm"
                            class="relative z-10"
                            onclick={() => onShowBottles(wine)}
                            title={m['wines.view_bottle_details']()}
                        >
                            {m['common.n_bottles']({ count: facts.bottleCount })}
                        </Button>
                    </Table.Cell>
                    {#if wine.rating}
                        <Table.Cell>{facts.rating}</Table.Cell>
                    {:else}
                        <!-- A dash keeps the column narrow; a screen reader still hears the text -->
                        <Table.Cell class="text-muted-foreground">
                            <span aria-hidden="true">—</span>
                            <span class="sr-only">{facts.rating}</span>
                        </Table.Cell>
                    {/if}
                    {#if auth.isAuthenticated}
                        <Table.Cell class="pe-4">
                            <div class="flex justify-end">
                                <WishButton wineId={wine.id} class={iconButton} />
                                <button
                                    type="button"
                                    class={iconButton}
                                    onclick={() => onAddBottle(wine)}
                                    title={m['wines.add_bottle_of_wine']()}
                                    aria-label={m['wines.add_bottle_of_wine']()}
                                >
                                    <SquarePlus aria-hidden="true" />
                                </button>
                                {@render actions(wine, false)}
                            </div>
                        </Table.Cell>
                    {/if}
                </Table.Row>
            {/each}
        </Table.Body>
    </Table.Root>
</Card>

<Card class="gap-0 py-0 lg:hidden">
    <ul class="divide-y">
        {#each rows as { wine, facts } (wine.id)}
            <li
                class="group/row relative flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 {wrapping}"
            >
                {#if showImages}
                    {@render thumbnail(wine)}
                {/if}
                <div class="flex min-w-0 grow flex-col gap-0.5">
                    <a href="/wines/{wine.id}" class="text-base/snug {nameLink}">{wine.name}</a>
                    <p class="text-xs text-muted-foreground">{facts.producer} · {facts.place}</p>
                    <!-- Inline, so that the facts wrap next to the badge rather than below it -->
                    <p class="mt-0.5 text-xs/6 text-muted-foreground">
                        {@render colorBadge(wine, 'me-1 [overflow-wrap:anywhere]')}
                        {facts.vintage} · {m['common.n_bottles']({ count: facts.bottleCount })} ·
                        {facts.price}
                    </p>
                </div>
                {@render actions(wine, true)}
            </li>
        {/each}
    </ul>
</Card>
