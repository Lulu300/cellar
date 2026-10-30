<script lang="ts">
    import { page } from '$app/state';
    import ErrorMessage from '#lib/components/layout/ErrorMessage.svelte';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
    <title>{pageTitle(String(page.status))}</title>
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <ErrorMessage heading="h1" />
    <Button href="/wines" variant="outline">{m['error_page.back_to_wines']()}</Button>
</div>
