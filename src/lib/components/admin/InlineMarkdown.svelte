<script lang="ts">
    import { parseInlineMarkdown } from '#lib/utils/inline-markdown.js';

    let { source }: { source: string } = $props();

    const segments = $derived(parseInlineMarkdown(source));
</script>

<!-- No whitespace between the tags: it would show in the text. -->
{#each segments as segment, i (i)}{#if segment.kind === 'code'}<code
            class="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{segment.text}</code
        >{:else if segment.kind === 'strong'}<strong>{segment.text}</strong
        >{:else if segment.kind === 'link'}<a
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2">{segment.text}</a
        >{:else}{segment.text}{/if}{/each}
