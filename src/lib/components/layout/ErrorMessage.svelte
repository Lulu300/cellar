<script lang="ts">
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';

    /** The status of the error page and what it means, under a heading of the given level. */
    let { heading }: { heading: 'h1' | 'h2' } = $props();
</script>

<!-- A load function's message is in English for the logs: the page shows a translated one. -->
<svelte:element this={heading} class="text-3xl font-bold mb-2">{page.status}</svelte:element>
<p class="text-muted-foreground mb-6">
    {page.status === 404 ? m['error_page.not_found']() : m['error_page.unexpected_error']()}
</p>
