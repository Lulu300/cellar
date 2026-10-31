<script lang="ts">
    import { page } from '$app/state';
    import NavCount from './NavCount.svelte';
    import { isCurrentSection, type NavItem } from './navigation.js';

    /** One entry of a menu: a link to a page, or a button for the logout. */
    let { item, onchoose }: { item: NavItem; onchoose?: () => void } = $props();

    const classes =
        'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm whitespace-nowrap hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground';
</script>

{#snippet content()}
    <item.icon class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    {item.label}
    {#if item.count}<NavCount count={item.count} />{/if}
{/snippet}

{#if item.href}
    <a
        href={item.href}
        class={classes}
        aria-current={isCurrentSection(page.url.pathname, item.href) ? 'page' : undefined}
        onclick={onchoose}
    >
        {@render content()}
    </a>
{:else}
    <button
        type="button"
        class={classes}
        onclick={() => {
            onchoose?.();
            item.onclick?.();
        }}
    >
        {@render content()}
    </button>
{/if}
