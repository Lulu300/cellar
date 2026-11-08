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

<ErrorMessage heading="h1" />
<Button href="/wines" variant="outline">{m['error_page.back_to_wines']()}</Button>
