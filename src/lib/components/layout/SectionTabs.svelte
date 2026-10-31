<script lang="ts">
    import { page } from '$app/state';
    import NavCount from './NavCount.svelte';
    import { isCurrentSection, type NavItem } from './navigation.js';

    /** The pages of a section, as tabs above the page: the admin's, the purchases'. */
    let { label, items }: { label: string; items: NavItem[] } = $props();
</script>

<nav class="mb-6 flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1" aria-label={label}>
    {#each items as item (item.href)}
        {@const current = isCurrentSection(page.url.pathname, item.href!)}
        <a
            href={item.href}
            aria-current={current ? 'page' : undefined}
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {current
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
        >
            <item.icon class="h-4 w-4" aria-hidden="true" />
            {item.label}
            {#if item.count}<NavCount count={item.count} />{/if}
        </a>
    {/each}
</nav>
