<script lang="ts">
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { pageNumbers } from '#lib/utils/pagination.js';

    /** `page` counts from 1. Shows nothing while everything fits on one page. */
    let {
        page,
        perPage,
        total,
        onPageChange
    }: {
        page: number;
        perPage: number;
        total: number;
        onPageChange: (page: number) => void;
    } = $props();

    const pageCount = $derived(Math.ceil(total / perPage));
    const first = $derived((page - 1) * perPage + 1);
    const last = $derived(Math.min(page * perPage, total));
</script>

{#if pageCount > 1}
    <!-- A container: the labels of the arrows show only where the pagination has room for them,
         which in the admin's narrow columns it has not, whatever the width of the window. -->
    <nav
        class="@container flex flex-wrap items-center justify-between gap-2"
        aria-label={m['pagination.label']()}
    >
        <p class="text-sm text-muted-foreground">
            {m['pagination.showing']({ first, last, total })}
        </p>
        <div class="flex flex-wrap items-center gap-1">
            <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onclick={() => onPageChange(page - 1)}
                aria-label={m['pagination.previous']()}
            >
                <ChevronLeft class="h-4 w-4" />
                <span class="hidden @lg:inline">{m['pagination.previous']()}</span>
            </Button>
            {#each pageNumbers(page, pageCount) as number (number)}
                <Button
                    variant={number === page ? 'default' : 'outline'}
                    size="sm"
                    class="min-w-8"
                    aria-current={number === page ? 'page' : undefined}
                    onclick={() => onPageChange(number)}
                >
                    {number}
                </Button>
            {/each}
            <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onclick={() => onPageChange(page + 1)}
                aria-label={m['pagination.next']()}
            >
                <span class="hidden @lg:inline">{m['pagination.next']()}</span>
                <ChevronRight class="h-4 w-4" />
            </Button>
        </div>
    </nav>
{/if}
