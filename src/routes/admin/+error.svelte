<script lang="ts">
    import { page } from '$app/state';
    import ErrorMessage from '#lib/components/layout/ErrorMessage.svelte';
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { m } from '#lib/paraglide/messages.js';
</script>

<!-- Shown inside the admin layout, which keeps its navigation and its h1. -->
<svelte:head>
    <title>{pageTitle(String(page.status), m['admin.title']())}</title>
</svelte:head>

<ErrorMessage heading="h2" />
