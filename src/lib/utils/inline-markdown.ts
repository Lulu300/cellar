export type MarkdownSegment =
    | { kind: 'text' | 'code' | 'strong'; text: string }
    | { kind: 'link'; text: string; href: string };

// The inline Markdown that the upgrade actions of releases.json use: `code`, **bold** and links.
// Anything else stays plain text. Links must be absolute http(s) URLs, so that no javascript: one
// can get through.
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Splits `source` into segments for InlineMarkdown.svelte, which renders them as elements, never
 * as HTML: the text cannot add markup of its own.
 */
export function parseInlineMarkdown(source: string): MarkdownSegment[] {
    const segments: MarkdownSegment[] = [];
    let end = 0;
    for (const match of source.matchAll(INLINE)) {
        if (match.index > end)
            segments.push({ kind: 'text', text: source.slice(end, match.index) });
        const [, code, strong, linkText, href] = match;
        if (code !== undefined) segments.push({ kind: 'code', text: code });
        else if (strong !== undefined) segments.push({ kind: 'strong', text: strong });
        else segments.push({ kind: 'link', text: linkText, href });
        end = match.index + match[0].length;
    }
    if (end < source.length) segments.push({ kind: 'text', text: source.slice(end) });
    return segments;
}
