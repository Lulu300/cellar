<script lang="ts">
    import { Ellipsis, ShoppingCart } from '@lucide/svelte';
    import { afterNavigate } from '$app/navigation';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import NavCount from './NavCount.svelte';
    import NavList from './NavList.svelte';
    import {
        isCurrentSection,
        TAB_BAR_PATHS,
        withoutPages,
        type NavSection
    } from './navigation.js';

    /**
     * The tab bar of the app installed on a phone, at the bottom of the screen, where the thumb
     * reaches: the pages of every day, then « More », which opens the others above it.
     */
    let { sections }: { sections: NavSection[] } = $props();

    const sheetId = $props.id();
    let moreOpen = $state(false);
    let moreButton = $state<HTMLButtonElement>();

    // Each tab opens the first page of the menu at or under its path (the purchases, their first
    // tab), and is current on every page under it.
    const pages = $derived(sections.flatMap((section) => section.items));
    const tabs = $derived(
        TAB_BAR_PATHS.map((path) => {
            const item = pages.find((page) => page.href && isCurrentSection(page.href, path))!;
            const short =
                path === '/wines'
                    ? { label: m['common.wines']() }
                    : path === '/purchases'
                      ? { label: m['navigation.purchases'](), icon: ShoppingCart }
                      : {};
            return { ...item, ...short, path };
        })
    );
    const others = $derived(withoutPages(sections, TAB_BAR_PATHS));
    const inTabs = $derived(
        TAB_BAR_PATHS.some((path) => isCurrentSection(page.url.pathname, path))
    );

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

<nav
    aria-label={m['navigation.tab_bar']()}
    class="fixed inset-x-0 bottom-0 z-50 hidden h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground standalone:max-md:grid"
>
    {#each tabs as tab (tab.path)}
        <a
            href={tab.href}
            class={tabClasses}
            aria-current={!moreOpen && isCurrentSection(page.url.pathname, tab.path)
                ? 'page'
                : undefined}
        >
            <!-- The name comes first, for screen readers to say it before the count -->
            <span>{tab.label}</span>
            <span class="relative order-first">
                <tab.icon class="h-[22px] w-[22px]" aria-hidden="true" />
                {#if tab.count?.alert}<NavCount count={tab.count} badge />{/if}
            </span>
        </a>
    {/each}
    <button
        bind:this={moreButton}
        type="button"
        class="{tabClasses} {!moreOpen && !inTabs ? 'text-primary-text' : ''}"
        aria-expanded={moreOpen}
        aria-controls={moreOpen ? sheetId : undefined}
        onclick={() => (moreOpen = !moreOpen)}
    >
        <Ellipsis class="h-[22px] w-[22px]" aria-hidden="true" />
        {m['navigation.more']()}
    </button>
</nav>

{#if moreOpen}
    <!-- After the tab bar, so that Tab and screen readers go from « More » into it; hidden with the
         tab bar, should the window grow while it is open. The page behind dims, and a tap on it
         closes the sheet. -->
    <button
        type="button"
        class="fixed inset-0 z-40 hidden bg-black/35 standalone:max-md:block"
        aria-label={m['common.close']()}
        tabindex="-1"
        onclick={() => (moreOpen = false)}
    ></button>
    <nav
        id={sheetId}
        aria-label={m['navigation.more']()}
        class="fixed inset-x-0 bottom-0 z-40 hidden max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card px-3 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-card-foreground shadow-2xl standalone:max-md:block"
    >
        <NavList sections={others} onchoose={() => (moreOpen = false)} />
    </nav>
{/if}
