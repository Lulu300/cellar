<script lang="ts">
    import { Castle } from '@lucide/svelte';
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card } from '#lib/components/ui/card/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import * as Table from '#lib/components/ui/table/index.js';
    import Pagination from '#lib/components/table/Pagination.svelte';
    import PageSizeSelect from '#lib/components/table/PageSizeSelect.svelte';
    import SortableHeader from '#lib/components/table/SortableHeader.svelte';
    import DebouncedInput from '#lib/components/wines/DebouncedInput.svelte';
    import ProducerDialog from '#lib/components/producers/ProducerDialog.svelte';
    import {
        readProducerListQuery,
        shownProducers,
        type ProducerColumn
    } from '#lib/components/producers/producer-list.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import type { ProducerDTO } from '#lib/shared/dto.js';
    import { defaultDirection } from '#lib/shared/schemas/bottle-list.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { clampPage } from '#lib/utils/pagination.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    // The search, sort and page live in the URL: coming back from a producer finds them.
    const query = $derived(readProducerListQuery(page.url.searchParams));
    const shown = $derived(shownProducers(data.producers, query));
    const shownPage = $derived(clampPage(query.page, shown.length, query.perPage));
    const pageRows = $derived(
        shown.slice((shownPage - 1) * query.perPage, shownPage * query.perPage)
    );

    const sortBy = (column: ProducerColumn) => () => {
        const direction =
            query.sort === column
                ? query.direction === 'asc'
                    ? 'desc'
                    : 'asc'
                : defaultDirection(column);
        showTablePage({ sort: column, dir: direction, page: null });
    };
    const direction = (column: ProducerColumn) => (query.sort === column ? query.direction : null);

    const place = (producer: ProducerDTO) =>
        [producer.regionName, producer.countryName].filter(Boolean).join(', ');
    const imageUrl = (producer: ProducerDTO) =>
        producer.imageId ? data.imageUrls.get(producer.imageId) : undefined;

    let showDialog = $state(false);

    async function added(producer: ProducerDTO) {
        toasts.add(m['producers.added'](), 'success');
        await invalidate(CELLAR);
        await goto(`/producers/${producer.id}`);
    }

    // Its ::after covers the row, which must be positioned: a click anywhere opens the producer.
    const nameLink =
        "font-semibold transition-colors after:absolute after:inset-0 after:content-[''] group-hover/row:text-primary-text";
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.producers']())}</title>
    <meta name="description" content={m['producers.subtitle']()} />
</svelte:head>

{#snippet thumbnail(producer: ProducerDTO)}
    {@const url = imageUrl(producer)}
    {#if url}
        <img src={url} alt="" class="h-13 w-10 shrink-0 rounded-md object-cover" />
    {:else}
        <div
            class="flex h-13 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
            <Castle class="size-4" aria-hidden="true" />
        </div>
    {/if}
{/snippet}

<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
    <div>
        <h1 class="text-3xl font-bold">{m['navigation.producers']()}</h1>
        <p class="text-muted-foreground">{m['producers.subtitle']()}</p>
    </div>
    {#if auth.isAuthenticated}
        <Button onclick={() => (showDialog = true)}>{m['producers.add']()}</Button>
    {/if}
</div>

<div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="w-full space-y-2 sm:w-96">
            <Label for="producer-search">{m['wines.search']()}</Label>
            <DebouncedInput
                id="producer-search"
                value={query.search}
                onChange={(search) => showTablePage({ search: search || null, page: null })}
                placeholder={m['producers.search']()}
            />
        </div>
        <PageSizeSelect perPage={query.perPage} />
    </div>

    {#if shown.length === 0}
        <Card class="p-8 text-center text-muted-foreground">
            {data.producers.length === 0 ? m['producers.none']() : m['producers.no_match']()}
        </Card>
    {:else}
        <!-- A table on a computer -->
        <Card class="hidden py-0 md:block">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <SortableHeader
                            label={m['common.producer']()}
                            direction={direction('name')}
                            onSort={sortBy('name')}
                        />
                        <SortableHeader
                            label={m['common.wines']()}
                            direction={direction('wineCount')}
                            onSort={sortBy('wineCount')}
                        />
                        <SortableHeader
                            label={m['producers.in_cellar']()}
                            direction={direction('bottleCount')}
                            onSort={sortBy('bottleCount')}
                        />
                        <SortableHeader
                            label={m['producers.drunk']()}
                            direction={direction('consumedCount')}
                            onSort={sortBy('consumedCount')}
                        />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each pageRows as producer (producer.id)}
                        <Table.Row class="group/row relative">
                            <Table.Cell class="ps-4 py-2.5 whitespace-normal">
                                <div class="flex items-center gap-3">
                                    {@render thumbnail(producer)}
                                    <div class="[overflow-wrap:anywhere]">
                                        <a href="/producers/{producer.id}" class={nameLink}
                                            >{producer.name}</a
                                        >
                                        {#if place(producer)}
                                            <p class="mt-0.5 text-xs text-muted-foreground">
                                                {place(producer)}
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                            </Table.Cell>
                            <Table.Cell class="tabular-nums">{producer.wineCount}</Table.Cell>
                            <Table.Cell class="tabular-nums">{producer.bottleCount}</Table.Cell>
                            <Table.Cell class="tabular-nums">{producer.consumedCount}</Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </Card>

        <!-- A list on a phone -->
        <Card class="py-0 md:hidden">
            <ul class="divide-y">
                {#each pageRows as producer (producer.id)}
                    <li
                        class="group/row relative flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 [overflow-wrap:anywhere]"
                    >
                        {@render thumbnail(producer)}
                        <div class="flex min-w-0 grow flex-col gap-0.5">
                            <a href="/producers/{producer.id}" class="text-base/snug {nameLink}"
                                >{producer.name}</a
                            >
                            {#if place(producer)}
                                <p class="text-xs text-muted-foreground">{place(producer)}</p>
                            {/if}
                            <p class="text-xs text-muted-foreground">
                                {m['producers.n_wines']({ count: producer.wineCount })} · {m[
                                    'common.n_in_cellar'
                                ]({ count: producer.bottleCount })} · {m['producers.n_drunk']({
                                    count: producer.consumedCount
                                })}
                            </p>
                        </div>
                    </li>
                {/each}
            </ul>
        </Card>
    {/if}

    <Pagination
        page={shownPage}
        perPage={query.perPage}
        total={shown.length}
        onPageChange={(page) => showTablePage({ page })}
    />
</div>

<ProducerDialog bind:open={showDialog} onSaved={added} />
