<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';
    import BottleTable from '#lib/components/bottles/BottleTable.svelte';
    import BackButton from '#lib/components/layout/BackButton.svelte';
    import PageSizeSelect from '#lib/components/table/PageSizeSelect.svelte';
    import Pagination from '#lib/components/table/Pagination.svelte';

    let { data } = $props();

    // The load function filters, sorts and pages the bottles from the query of the URL. A new
    // filter keeps the sort on screen, a default one included: the URL then holds it.
    function changeFilter(filter: string) {
        showTablePage({ filter, sort: data.sort, dir: data.direction, page: null });
    }
</script>

<svelte:head>
    <title>{pageTitle(m['history.title']())}</title>
    <meta name="description" content={m['history.subtitle']()} />
</svelte:head>

<div class="flex justify-between items-center mb-8">
    <div>
        <h1 class="text-3xl font-bold">{m['history.title']()}</h1>
        <p class="text-muted-foreground">{m['history.subtitle']()}</p>
    </div>

    <BackButton />
</div>

<Card>
    <CardHeader>
        <div class="flex flex-wrap justify-between items-center gap-4">
            <CardTitle>
                {data.filter === 'in_cave'
                    ? m['history.wines_in_cave']()
                    : data.filter === 'consumed'
                      ? m['history.consumed_wines']()
                      : m['common.all_bottles']()}
                ({m['history.total']({ count: data.total })})
            </CardTitle>
            <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                <!-- Filter Selector -->
                <div class="flex items-center space-x-2">
                    <label for="history-filter" class="text-sm text-muted-foreground"
                        >{m['history.filter']()}</label
                    >
                    <Select.Root type="single" value={data.filter} onValueChange={changeFilter}>
                        <Select.Trigger id="history-filter" class="w-32 h-9">
                            {#if data.filter === 'all'}
                                {m['history.all_wines']()}
                            {:else if data.filter === 'in_cave'}
                                {m['history.in_cave']()}
                            {:else if data.filter === 'consumed'}
                                {m['availability.consumed']()}
                            {/if}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all" label={m['history.all_wines']()}
                                >{m['history.all_wines']()}</Select.Item
                            >
                            <Select.Item value="in_cave" label={m['history.in_cave']()}
                                >{m['history.in_cave']()}</Select.Item
                            >
                            <Select.Item value="consumed" label={m['availability.consumed']()}
                                >{m['availability.consumed']()}</Select.Item
                            >
                        </Select.Content>
                    </Select.Root>
                </div>

                <PageSizeSelect perPage={data.perPage} />
            </div>
        </div>
    </CardHeader>
    <CardContent>
        <div class="space-y-4">
            <BottleTable
                bottles={data.bottles}
                columns={[...data.columns, 'notes']}
                sort={{ column: data.sort, direction: data.direction }}
                onSort={({ column, direction }) =>
                    showTablePage({ sort: column, dir: direction, page: null })}
                emptyMessage={m['history.no_bottles_found']()}
            />

            <Pagination
                page={data.page}
                perPage={data.perPage}
                total={data.total}
                onPageChange={(page) => showTablePage({ page })}
            />
        </div>
    </CardContent>
</Card>
