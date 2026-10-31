<script lang="ts">
    import { ShoppingCart } from '@lucide/svelte';
    import SectionTabs from '#lib/components/layout/SectionTabs.svelte';
    import { purchasesSection } from '#lib/components/layout/navigation.js';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();

    // The root layout loads the counts that the tabs show, as the menu does.
    const section = $derived(purchasesSection(data.shortageCount, data.wishCount));
</script>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <h1 class="mb-6 flex items-center gap-2 text-3xl font-bold tracking-tight">
        <ShoppingCart class="h-8 w-8 text-primary" />
        {section.label}
    </h1>

    <SectionTabs label={section.label} items={section.items} />

    {@render children()}
</div>
