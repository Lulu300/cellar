<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
</script>

<!-- Leads to /wines without JavaScript; the link is for a browser that ignores the refresh. -->
<svelte:head>
    <meta http-equiv="refresh" content="0; url=/wines" />
</svelte:head>

<p class="py-8 text-center">
    <a href="/wines" class="underline">{m['navigation.my_wines']()}</a>
</p>
