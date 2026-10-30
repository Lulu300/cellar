<script lang="ts">
    import { confirm } from '#lib/components/layout/confirm.svelte.js';

    // The app's own dialog takes its text from the locale files
    const remove = () => confirm({ message: m['cases.used']() });
</script>

{#if colour === 'Deep red'}
    <div class={'Big box'}>
        <button onclick={remove}>{m['cases.used']()}</button>
    </div>
{/if}
