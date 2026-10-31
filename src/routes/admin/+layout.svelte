<script lang="ts">
    import { page } from '$app/state';
    import { Archive, Database, Image, Settings } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import UpgradeBanner from '#lib/components/admin/UpgradeBanner.svelte';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();

    // The docs of the latest release, which is what a published image runs.
    const API_DOC = 'https://github.com/Lulu300/cellar/blob/main/docs/API.md';

    const sections = $derived([
        { href: '/admin/settings', label: m['admin.section_settings'](), icon: Settings },
        { href: '/admin/backups', label: m['admin.section_backups'](), icon: Archive },
        { href: '/admin/data', label: m['admin.section_data'](), icon: Database },
        { href: '/admin/images', label: m['admin.images'](), icon: Image }
    ]);
</script>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <div class="mb-6">
        <h1 class="flex items-center gap-2 text-3xl font-bold">
            <Settings class="h-8 w-8" />
            {m['admin.title']()}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
            {m['preferences.version']({ version: __APP_VERSION__ })}
            ·
            <a
                href={API_DOC}
                target="_blank"
                rel="noopener noreferrer"
                class="underline underline-offset-2 hover:text-foreground">{m['admin.api_doc']()}</a
            >
        </p>
    </div>

    <nav class="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted p-1" aria-label={m['admin.title']()}>
        {#each sections as section (section.href)}
            {@const current = page.url.pathname.startsWith(section.href)}
            <a
                href={section.href}
                aria-current={current ? 'page' : undefined}
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {current
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'}"
            >
                <section.icon class="h-4 w-4" />
                {section.label}
            </a>
        {/each}
    </nav>

    <UpgradeBanner {...data.upgrade} />

    {@render children()}
</div>
