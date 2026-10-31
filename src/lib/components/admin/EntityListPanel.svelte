<script lang="ts" generics="T extends { id: string }">
    import type { Snippet } from 'svelte';
    import { CircleAlert, Plus, SquarePen, Trash } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import Pagination from '#lib/components/table/Pagination.svelte';
    import SearchField from '#lib/components/admin/SearchField.svelte';
    import {
        PER_PAGE,
        type EntityCollection
    } from '#lib/components/admin/entity-collection.svelte.js';

    /** A searchable, paginated list of the admin, with its edit and delete buttons. */
    let {
        collection,
        title,
        searchPlaceholder,
        entry,
        filters,
        onClearFilters,
        addLabel,
        onAdd,
        onEdit,
        onDelete
    }: {
        collection: EntityCollection<T>;
        title: string;
        searchPlaceholder: string;
        /** What an entry shows. */
        entry: Snippet<[T]>;
        /** More filters, under the search, which `onClearFilters` resets. */
        filters?: Snippet;
        onClearFilters?: () => void;
        addLabel?: string;
        onAdd?: () => void;
        onEdit?: (item: T) => void;
        onDelete: (item: T) => void;
    } = $props();

    const isFiltered = $derived(collection.filtered.length < collection.items.length);
</script>

<section class="space-y-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">{title}</h2>
        {#if onAdd}
            <Button size="sm" onclick={onAdd}>
                <Plus class="h-4 w-4 mr-2" />
                {addLabel}
            </Button>
        {/if}
    </div>

    <SearchField
        value={collection.query}
        placeholder={searchPlaceholder}
        onSearch={(query) => collection.search(query)}
    />
    {#if filters}
        <div class="rounded-lg bg-muted/50 p-3">
            <div class="mb-3 flex items-center gap-2">
                <h3 class="text-sm font-medium">{m['common.filters']()}</h3>
                <Button size="sm" variant="outline" onclick={onClearFilters}>
                    {m['admin.clear_filters']()}
                </Button>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {@render filters()}
            </div>
        </div>
    {/if}

    <ul class="space-y-2">
        {#each collection.paged as item (item.id)}
            <li class="space-y-1">
                <div class="flex items-center justify-between gap-2 rounded border p-2">
                    <div class="min-w-0">{@render entry(item)}</div>
                    <div class="flex shrink-0 gap-1">
                        {#if onEdit}
                            <Button
                                size="sm"
                                variant="ghost"
                                aria-label={m['common.edit']()}
                                onclick={() => onEdit(item)}
                            >
                                <SquarePen class="h-4 w-4" />
                            </Button>
                        {/if}
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label={m['common.delete']()}
                            disabled={collection.deleting.has(item.id)}
                            onclick={() => onDelete(item)}
                        >
                            <Trash class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {#if collection.inUse[item.id]}
                    <p
                        class="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
                    >
                        <CircleAlert class="h-4 w-4 shrink-0" />
                        {collection.inUse[item.id]}
                    </p>
                {/if}
            </li>
        {:else}
            <li class="py-4 text-center text-muted-foreground">
                {isFiltered ? m['admin.no_match']() : m['admin.no_entries']()}
            </li>
        {/each}
    </ul>

    <Pagination
        page={collection.page}
        perPage={PER_PAGE}
        total={collection.filtered.length}
        onPageChange={(page) => (collection.page = page)}
    />
</section>
