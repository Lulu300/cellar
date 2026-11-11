<script lang="ts">
    /**
     * The name of a wine's producer, which leads to the producer's page; the text alone for a wine
     * without a producer. It sits above a link that covers its card or row, and takes the pointer
     * back from a ScrollingText around it, which lets it through to that link.
     */
    let {
        producerId,
        name,
        class: className = ''
    }: {
        producerId: string | null | undefined;
        /** What to show: the producer's name, or what a wine without one says. */
        name: string;
        class?: string;
    } = $props();
</script>

{#if producerId}
    <a
        href="/producers/{producerId}"
        class="pointer-events-auto relative z-10 underline-offset-2 transition-colors hover:text-primary-text hover:underline {className}"
        >{name}</a
    >
{:else}
    {name}
{/if}
