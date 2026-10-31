<script lang="ts">
    import { Ellipsis, LayoutGrid, PackageOpen, ShoppingCart, Wine } from '@lucide/svelte';
    import { afterNavigate } from '$app/navigation';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import NavCount from './NavCount.svelte';
    import NavList from './NavList.svelte';
    import { alertOf, isCurrentSection, withoutPages, type NavSection } from './navigation.js';

    /**
     * The tab bar of the app installed on a phone, at the bottom of the screen, where the thumb
     * reaches: the pages of every day, then « More », which opens the others above it.
     */
    let { sections }: { sections: NavSection[] } = $props();

    const sheetId = $props.id();
    let moreOpen = $state(false);
    let moreButton = $state<HTMLButtonElement>();

    const shortage = $derived(alertOf(sections));
    const tabs = $derived([
        { href: '/wines', label: m['common.wines'](), icon: Wine },
        { href: '/storage', label: m['navigation.storage'](), icon: LayoutGrid },
        { href: '/out-of-cellar', label: m['navigation.out_of_cellar'](), icon: PackageOpen },
        // The purchases open on their first tab
        { href: '/purchases', label: m['navigation.purchases'](), icon: ShoppingCart }
    ]);
    const others = $derived(
        withoutPages(
            sections,
            tabs.map((tab) => tab.href)
        )
    );
    const inTabs = $derived(tabs.some((tab) => isCurrentSection(page.url.pathname, tab.href)));

    afterNavigate(() => (moreOpen = false));

    function onkeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || !moreOpen) return;
        moreOpen = false;
        moreButton?.focus();
    }

    const tabClasses =
        'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground aria-[current=page]:text-primary-text aria-[expanded=true]:text-primary-text';
</script>

<svelte:window {onkeydown} />

{#if moreOpen}
    <!-- The page behind dims; a tap on it closes the sheet -->
    <button
        type="button"
        class="fixed inset-0 z-40 bg-black/35"
        aria-label={m['common.close']()}
        tabindex="-1"
        onclick={() => (moreOpen = false)}
    ></button>
    <nav
        id={sheetId}
        aria-label={m['navigation.more']()}
        class="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card px-3 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-card-foreground shadow-2xl"
    >
        <NavList sections={others} onchoose={() => (moreOpen = false)} />
    </nav>
{/if}

<nav
    aria-label={m['navigation.tab_bar']()}
    class="fixed inset-x-0 bottom-0 z-50 hidden h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground standalone:max-md:grid"
>
    {#each tabs as tab (tab.href)}
        <a
            href={tab.href}
            class={tabClasses}
            aria-current={!moreOpen && isCurrentSection(page.url.pathname, tab.href)
                ? 'page'
                : undefined}
        >
            <!-- The name comes first, for screen readers to say it before the count -->
            <span>{tab.label}</span>
            <span class="relative order-first">
                <tab.icon class="h-[22px] w-[22px]" aria-hidden="true" />
                {#if tab.href === '/purchases' && shortage}<NavCount count={shortage} badge />{/if}
            </span>
        </a>
    {/each}
    <button
        bind:this={moreButton}
        type="button"
        class="{tabClasses} {!moreOpen && !inTabs ? 'text-primary-text' : ''}"
        aria-expanded={moreOpen}
        aria-controls={sheetId}
        onclick={() => (moreOpen = !moreOpen)}
    >
        <Ellipsis class="h-[22px] w-[22px]" aria-hidden="true" />
        {m['navigation.more']()}
    </button>
</nav>
