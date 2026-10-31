<script lang="ts">
    import { Archive, Database, Image, Settings } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import UpgradeBanner from '#lib/components/admin/UpgradeBanner.svelte';
    import SectionTabs from '#lib/components/layout/SectionTabs.svelte';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();

    // The docs of the latest release, which is what a published image runs.
    const API_DOC = 'https://github.com/Lulu300/cellar/blob/main/docs/API.md';

    const sections = $derived([
        { href: '/admin/settings', label: m['common.settings'](), icon: Settings },
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

    <SectionTabs label={m['admin.title']()} items={sections} />

    <UpgradeBanner {...data.upgrade} />

    {@render children()}
</div>
