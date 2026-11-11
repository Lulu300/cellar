<script lang="ts">
    import { ImageIcon, SquarePen, Trash } from '@lucide/svelte';
    import { goto, invalidate } from '$app/navigation';
    import { errorMessage, request } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { iconButton } from '#lib/components/layout/button-states.js';
    import BackButton from '#lib/components/layout/BackButton.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import ProducerDialog from '#lib/components/producers/ProducerDialog.svelte';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import * as Table from '#lib/components/ui/table/index.js';
    import WineColorBadge from '#lib/components/wines/WineColorBadge.svelte';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { cn } from '#lib/utils.js';
    import { safeUrl } from '#lib/utils/url.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const producer = $derived(data.producer);
    const photoUrl = $derived(producer.imageId ? data.imageUrls.get(producer.imageId) : undefined);
    const place = $derived([producer.regionName, producer.countryName].filter(Boolean).join(', '));
    const websiteUrl = $derived(producer.website ? safeUrl(producer.website) : null);
    // Nothing but a name: the page says what it can hold
    const nameOnly = $derived(
        !photoUrl && !place && !producer.website && !producer.contact && !producer.description
    );
    const figures = $derived([
        m['producers.n_wines']({ count: producer.wineCount }),
        m['common.n_in_cellar']({ count: producer.bottleCount }),
        m['producers.n_drunk']({ count: producer.consumedCount })
    ]);

    let showDialog = $state(false);
    const headerButton = cn(iconButton, 'size-10');
    const deleteHintId = $props.id();

    async function saved() {
        toasts.add(m['producers.saved'](), 'success');
        await invalidate(CELLAR);
    }

    async function remove() {
        if (!(await confirm({ message: m['producers.confirm_delete']({ name: producer.name }) }))) {
            return;
        }
        try {
            await request(`/api/producers/${producer.id}`, { method: 'DELETE' });
        } catch (error) {
            toasts.add(errorMessage(error), 'error', 8000);
            return;
        }
        toasts.add(m['producers.deleted'](), 'success');
        await invalidate(CELLAR);
        await goto('/producers');
    }

    // Its ::after covers the row, which must be positioned: a click anywhere opens the wine.
    const nameLink =
        "font-semibold transition-colors after:absolute after:inset-0 after:content-[''] group-hover/row:text-primary-text";
</script>

<svelte:head>
    <title>{pageTitle(producer.name, m['navigation.producers']())}</title>
</svelte:head>

<div class="mb-6">
    <BackButton />
</div>

<div class="space-y-6">
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <h1 class="[overflow-wrap:anywhere]">{producer.name}</h1>
                {#if auth.isAuthenticated}
                    <div class="ml-auto flex shrink-0">
                        <button
                            class={headerButton}
                            onclick={() => (showDialog = true)}
                            title={m['producers.edit']()}
                            aria-label={m['producers.edit']()}
                        >
                            <SquarePen class="size-6" aria-hidden="true" />
                        </button>
                        <button
                            class={headerButton}
                            onclick={remove}
                            disabled={producer.wineCount > 0}
                            title={m['producers.delete']()}
                            aria-label={m['producers.delete']()}
                            aria-describedby={producer.wineCount > 0 ? deleteHintId : undefined}
                        >
                            <Trash class="size-6" aria-hidden="true" />
                        </button>
                    </div>
                {/if}
            </CardTitle>
            {#if auth.isAuthenticated && producer.wineCount > 0}
                <p id={deleteHintId} class="text-xs text-muted-foreground">
                    {m['producers.cannot_delete']({ count: producer.wineCount })}
                </p>
            {/if}
        </CardHeader>
        <CardContent>
            <div class="grid gap-6 md:grid-cols-[minmax(0,45rem)_auto]">
                <div class="space-y-3 text-sm [overflow-wrap:anywhere]">
                    <p class="text-base font-medium">{figures.join(' · ')}</p>
                    {#if nameOnly && auth.isAuthenticated}
                        <p class="text-muted-foreground">{m['producers.name_only']()}</p>
                    {/if}
                    {#if place}
                        <div>
                            <strong>{m['common.label']({ label: m['producers.place']() })}</strong>
                            {place}
                        </div>
                    {/if}
                    {#if producer.website}
                        <div>
                            <strong>{m['common.label']({ label: m['common.website']() })}</strong>
                            {#if websiteUrl}
                                <a
                                    href={websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-primary-text underline">{producer.website}</a
                                >
                            {:else}
                                {producer.website}
                            {/if}
                        </div>
                    {/if}
                    {#if producer.contact}
                        <div>
                            <strong>{m['common.label']({ label: m['producers.contact']() })}</strong
                            >
                            <p class="mt-1 whitespace-pre-line">{producer.contact}</p>
                        </div>
                    {/if}
                    {#if producer.description}
                        <div>
                            <strong
                                >{m['common.label']({ label: m['common.description']() })}</strong
                            >
                            <p class="mt-1 whitespace-pre-line">{producer.description}</p>
                        </div>
                    {/if}
                </div>
                {#if photoUrl}
                    <img
                        src={photoUrl}
                        alt={producer.name}
                        class="max-h-80 w-full max-w-60 rounded-md object-cover md:justify-self-end"
                    />
                {/if}
            </div>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle><h2>{m['producers.its_wines']()}</h2></CardTitle>
        </CardHeader>
        <CardContent class="px-0">
            {#if producer.wines.length === 0}
                <p class="px-6 text-sm text-muted-foreground">{m['producers.no_wines']()}</p>
            {:else}
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head class="ps-6">{m['common.wine']()}</Table.Head>
                            <Table.Head class="hidden sm:table-cell"
                                >{m['common.appellation']()}</Table.Head
                            >
                            <Table.Head class="text-end">{m['producers.in_cellar']()}</Table.Head>
                            <Table.Head class="pe-6 text-end">{m['producers.drunk']()}</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each producer.wines as wine (wine.id)}
                            {@const url = wine.imageId ? data.imageUrls.get(wine.imageId) : ''}
                            <Table.Row class="group/row relative">
                                <Table.Cell class="ps-6 py-2.5 whitespace-normal">
                                    <div class="flex items-center gap-3">
                                        {#if url}
                                            <img
                                                src={url}
                                                alt=""
                                                class="h-13 w-10 shrink-0 rounded-md object-cover"
                                            />
                                        {:else}
                                            <div
                                                class="flex h-13 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                            >
                                                <ImageIcon class="size-4" aria-hidden="true" />
                                            </div>
                                        {/if}
                                        <div class="space-y-1 [overflow-wrap:anywhere]">
                                            <a href="/wines/{wine.id}" class={nameLink}
                                                >{wine.name}</a
                                            >
                                            <p class="text-xs text-muted-foreground">
                                                <WineColorBadge
                                                    name={wine.color}
                                                    hex={wine.colorHex}
                                                    class="me-1 text-xs"
                                                />
                                                <span class="sm:hidden">{wine.appellationName}</span
                                                >
                                            </p>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="hidden whitespace-normal sm:table-cell">
                                    {wine.appellationName}
                                    <p class="text-xs text-muted-foreground">
                                        {wine.regionName}, {wine.countryName}
                                    </p>
                                </Table.Cell>
                                <Table.Cell class="text-end tabular-nums"
                                    >{wine.bottleCount}</Table.Cell
                                >
                                <Table.Cell class="pe-6 text-end tabular-nums"
                                    >{wine.consumedCount}</Table.Cell
                                >
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            {/if}
        </CardContent>
    </Card>
</div>

<ProducerDialog bind:open={showDialog} {producer} imageUrl={photoUrl} onSaved={saved} />
