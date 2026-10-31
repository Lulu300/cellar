<script lang="ts">
    import '../app.css';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Lock, Menu, Settings, X } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { afterNavigate, goto } from '$app/navigation';
    import { applyTheme } from '#lib/utils/theme-colors.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import ToastContainer from '#lib/components/layout/ToastContainer.svelte';
    import CellarLogo from '#lib/components/layout/CellarLogo.svelte';
    import { asksForAccessCode } from '#lib/components/layout/session.js';
    import LoginDialog from '#lib/components/layout/LoginDialog.svelte';
    import ConfirmDialog from '#lib/components/layout/ConfirmDialog.svelte';
    import NavList from '#lib/components/layout/NavList.svelte';
    import NavCount from '#lib/components/layout/NavCount.svelte';
    import NavSectionMenu from '#lib/components/layout/NavSectionMenu.svelte';
    import TabBar from '#lib/components/layout/TabBar.svelte';
    import {
        alertOf,
        navSections,
        pageTitle,
        settingsSection
    } from '#lib/components/layout/navigation.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';

    let { children, data } = $props();

    $effect(() => applyTheme(preferences.theme, preferences.isDark));

    let loginDialog: LoginDialog;
    // The ☰ menu, which lists the sections where the top bar does not fit or a finger cannot hover it
    let menuOpen = $state(false);
    let menuButton = $state<HTMLButtonElement | null>(null);

    const sections = $derived(
        navSections({
            authenticated: auth.isAuthenticated,
            shortageCount: data.shortageCount,
            outOfCellarCount: data.outOfCellarCount
        })
    );
    const settings = $derived(settingsSection(auth.isAuthenticated, handleLogout));
    const shortage = $derived(alertOf(sections));

    onMount(promptLoginOnExpiredSession);

    // The server guard of the pages that need a session (redirectWithoutSession) sends visitors to
    // /wines?login. On entry the page was rendered with the session of that request. A ?login
    // reached in the page, by that redirect or by going back in the history, comes after the page
    // was rendered, when the session may have died or begun since: the server is asked again. As
    // long as no code is set, the dialog opens on entry so that the owner chooses one.
    afterNavigate(async ({ type }) => {
        menuOpen = false;
        const wantsLogin = page.url.searchParams.has('login');
        if (wantsLogin && type !== 'enter') await auth.checkSession();
        if ((type === 'enter' && !auth.accessCodeSet) || (wantsLogin && !auth.isAuthenticated)) {
            loginDialog.show();
        }
    });

    // Called on logout and when the login dialog is dismissed. After an expiry the dialog opens over
    // the page rather than leaving it, so that logging in again keeps the user there.
    function leavePageIfSessionRequired() {
        if (page.data.requiresSession) goto('/wines');
    }

    // hooks.server.ts answers 401 to a write or to the admin API without a valid session. Checking
    // every response here turns that into a login prompt, instead of an error in each page's handler.
    function promptLoginOnExpiredSession() {
        const nativeFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await nativeFetch(...args);
            // The toasts leave that error to this dialog (toast.svelte.ts).
            if (asksForAccessCode(response.status, ...args)) {
                const expired = auth.isAuthenticated;
                auth.markLoggedOut();
                loginDialog.show(expired ? m['auth.session_expired']() : '');
            }
            return response;
        };
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape' || !menuOpen) return;
        menuOpen = false;
        menuButton?.focus();
    }

    async function handleLogout() {
        await auth.logout();
        leavePageIfSessionRequired();
        toasts.add(m['auth.successfully_logged_out'](), 'success');
    }
</script>

<svelte:head>
    <title>{pageTitle()}</title>
</svelte:head>

<svelte:window onkeydown={closeMenuOnEscape} />

<div class="min-h-screen bg-background">
    <header class="border-b bg-card text-card-foreground">
        <div
            class="container mx-auto py-4 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]"
        >
            <div class="flex justify-between items-center gap-2">
                <!-- Not a heading: each page has its own h1. -->
                <div
                    class="text-xl font-bold text-foreground flex items-center gap-2 whitespace-nowrap"
                >
                    <CellarLogo class="h-6 w-6" />
                    {m['navigation.wine_cellar']()}
                </div>
                <div class="flex items-center gap-2">
                    <!-- Where a mouse can hover it; touch screens get the ☰ menu, touch laptops both -->
                    <nav class="hidden md:pointer-fine:block" aria-label={m['navigation.menu']()}>
                        <ul class="flex items-center gap-0.5">
                            {#each sections as section (section.label)}
                                <li><NavSectionMenu {section} /></li>
                            {/each}
                            <li class="ml-2">
                                <NavSectionMenu section={settings} icon={Settings} align="end" />
                            </li>
                        </ul>
                    </nav>

                    {#if !auth.isAuthenticated}
                        <Button size="sm" onclick={() => loginDialog.show()}>
                            <Lock />
                            {m['common.login']()}
                        </Button>
                    {/if}

                    <!-- The installed app has its tab bar instead, on a phone -->
                    <Button
                        bind:ref={menuButton}
                        variant="ghost"
                        size="icon"
                        class="relative md:pointer-fine:no-touch:hidden standalone:max-md:hidden"
                        aria-expanded={menuOpen}
                        aria-controls={menuOpen ? 'navigation-menu' : undefined}
                        onclick={() => (menuOpen = !menuOpen)}
                    >
                        {#if menuOpen}<X />{:else}<Menu />{/if}
                        <!-- Named by its text rather than aria-label, which would hide the count -->
                        <span class="sr-only">{m['navigation.menu']()}</span>
                        <!-- Not next to the top bar of a touch laptop, whose Purchases shows it -->
                        {#if shortage && !menuOpen}
                            <span class="md:pointer-fine:hidden"
                                ><NavCount count={shortage} badge /></span
                            >
                        {/if}
                    </Button>
                </div>
            </div>

            {#if menuOpen}
                <nav
                    id="navigation-menu"
                    class="pt-2 md:pointer-fine:no-touch:hidden standalone:max-md:hidden"
                    aria-label={m['navigation.menu']()}
                >
                    <NavList
                        sections={[...sections, settings]}
                        onchoose={() => (menuOpen = false)}
                    />
                </nav>
            {/if}
        </div>
    </header>

    <!-- Room for the tab bar, which would cover the end of the page -->
    <main class="standalone:max-md:pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {@render children?.()}
    </main>

    <TabBar sections={[...sections, settings]} />

    <ToastContainer />
</div>

<LoginDialog bind:this={loginDialog} oncancel={leavePageIfSessionRequired} />
<ConfirmDialog />
