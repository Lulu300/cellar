<script lang="ts">
    import '../app.css';
    import favicon from '#lib/assets/favicon.svg';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Wine, Lock, LogOut, Menu, X } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { afterNavigate, goto } from '$app/navigation';
    import { applyTheme } from '#lib/utils/theme-colors.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import ToastContainer from '#lib/components/layout/ToastContainer.svelte';
    import { asksForAccessCode } from '#lib/components/layout/session.js';
    import LoginDialog from '#lib/components/layout/LoginDialog.svelte';
    import ConfirmDialog from '#lib/components/layout/ConfirmDialog.svelte';
    import { isCurrentSection, pageTitle } from '#lib/components/layout/navigation.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';

    let { children, data } = $props();

    $effect(() => applyTheme(preferences.theme, preferences.isDark));

    let loginDialog: LoginDialog;
    // The links of the navigation, shown in a menu below the xl breakpoint where they do not fit.
    let menuOpen = $state(false);

    const links = $derived([
        { href: '/wines', label: m['navigation.my_wines']() },
        { href: '/out-of-cellar', label: m['navigation.out_of_cellar']() },
        { href: '/wine-shortage', label: m['navigation.wine_shortage']() },
        { href: '/statistics', label: m['navigation.statistics']() },
        { href: '/storage', label: m['navigation.storage']() },
        { href: '/cellar-history', label: m['navigation.history']() },
        ...(auth.isAuthenticated
            ? [
                  { href: '/admin', label: m['navigation.admin']() },
                  { href: '/barcode', label: m['navigation.barcode']() }
              ]
            : []),
        { href: '/preferences', label: m['navigation.preferences']() }
    ]);

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

    async function handleLogout() {
        await auth.logout();
        leavePageIfSessionRequired();
        toasts.add(m['auth.successfully_logged_out'](), 'success');
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>{pageTitle()}</title>
</svelte:head>

{#snippet navLinks()}
    {#each links as link (link.href)}
        <li class="relative">
            <Button
                variant="ghost"
                size="sm"
                href={link.href}
                aria-current={isCurrentSection(page.url.pathname, link.href) ? 'page' : undefined}
                class="px-2 xl:px-1.5 2xl:px-2 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
                {link.label}
            </Button>
            {#if link.href === '/wine-shortage' && data.shortageCount > 0}
                <!-- A fixed dark red with white text keeps the count readable in every theme -->
                <span
                    class="absolute -top-2 -right-2 bg-red-700 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 border-2 border-background shadow-lg"
                >
                    {data.shortageCount}
                </span>
            {/if}
        </li>
    {/each}
{/snippet}

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
                    <Wine class="h-6 w-6" aria-hidden="true" />
                    {m['navigation.wine_cellar']()}
                </div>
                <div class="flex items-center gap-2">
                    <nav class="hidden xl:block">
                        <ul class="flex flex-wrap justify-end">
                            {@render navLinks()}
                        </ul>
                    </nav>

                    {#if auth.isAuthenticated}
                        <Button variant="outline" size="sm" onclick={handleLogout}>
                            <LogOut />
                            {m['common.logout']()}
                        </Button>
                    {:else}
                        <Button size="sm" onclick={() => loginDialog.show()}>
                            <Lock />
                            {m['common.login']()}
                        </Button>
                    {/if}

                    <Button
                        variant="ghost"
                        size="icon"
                        class="xl:hidden"
                        aria-label={m['navigation.menu']()}
                        aria-expanded={menuOpen}
                        aria-controls="navigation-menu"
                        onclick={() => (menuOpen = !menuOpen)}
                    >
                        {#if menuOpen}<X />{:else}<Menu />{/if}
                    </Button>
                </div>
            </div>

            {#if menuOpen}
                <nav id="navigation-menu" class="xl:hidden pt-2">
                    <ul class="flex flex-col items-start gap-1">
                        {@render navLinks()}
                    </ul>
                </nav>
            {/if}
        </div>
    </header>

    <main>
        {@render children?.()}
    </main>

    <ToastContainer />
</div>

<LoginDialog bind:this={loginDialog} oncancel={leavePageIfSessionRequired} />
<ConfirmDialog />
