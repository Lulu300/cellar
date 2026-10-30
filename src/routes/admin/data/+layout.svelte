<script lang="ts">
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { REFERENCE_ENTITIES } from '#lib/components/admin/entities.js';
    import type { LayoutProps } from './$types';

    let { children }: LayoutProps = $props();

    const lists = $derived([
        ...Object.values(REFERENCE_ENTITIES).map((entity) => ({
            slug: entity.slug,
            label: entity.labels().title
        })),
        { slug: 'wines', label: m['common.wines']() },
        { slug: 'bottles', label: m['admin.wine_bottles']() }
    ]);
</script>

<nav class="mb-6 flex flex-wrap gap-2" aria-label={m['admin.section_data']()}>
    {#each lists as list (list.slug)}
        {@const href = `/admin/data/${list.slug}`}
        <a
            {href}
            aria-current={page.url.pathname === href ? 'page' : undefined}
            class="rounded-full border px-3 py-1 text-sm transition-colors {page.url.pathname ===
            href
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'}"
        >
            {list.label}
        </a>
    {/each}
</nav>

{@render children()}
