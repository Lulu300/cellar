import { describe, expect, it } from 'vitest';
import releases from '../../../releases.json';
import { parseInlineMarkdown } from './inline-markdown';

describe('parseInlineMarkdown', () => {
    it('reads the code, bold text and links of the upgrade actions', () => {
        expect(
            parseInlineMarkdown(
                'Set `ORIGIN`, set **Backup Mode**, see [Access code](https://example.com/doc#access).'
            )
        ).toEqual([
            { kind: 'text', text: 'Set ' },
            { kind: 'code', text: 'ORIGIN' },
            { kind: 'text', text: ', set ' },
            { kind: 'strong', text: 'Backup Mode' },
            { kind: 'text', text: ', see ' },
            { kind: 'link', text: 'Access code', href: 'https://example.com/doc#access' },
            { kind: 'text', text: '.' }
        ]);
    });

    it('keeps markup, and links that are not http(s), as plain text', () => {
        const source = '<img src=x onerror=alert(1)> [click](javascript:alert(1)) `<b>`';

        expect(parseInlineMarkdown(source)).toEqual([
            { kind: 'text', text: '<img src=x onerror=alert(1)> [click](javascript:alert(1)) ' },
            { kind: 'code', text: '<b>' }
        ]);
    });

    // The admin shows them: an action that used other Markdown would show its raw syntax there.
    it('leaves no Markdown syntax in the text of any upgrade action of releases.json', () => {
        for (const action of releases.flatMap((release) => release.actions)) {
            const text = parseInlineMarkdown(action)
                .filter((segment) => segment.kind === 'text')
                .map((segment) => segment.text)
                .join('');
            expect(text, action).not.toMatch(/`|\*|\]\(|(^|\s)_\S/);
        }
    });
});
