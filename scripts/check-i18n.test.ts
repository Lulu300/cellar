import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkI18n } from './check-i18n.mjs';

// A small project: one case of each problem, each kind of hardcoded text in its own file, and
// code that must not be reported. Two of its keys may share a text.
const problems = checkI18n(fileURLToPath(new URL('check-i18n-cases', import.meta.url)), [
    ['cases.same_text_allowed', 'cases.same_text_allowed_too']
]);

const hardcodedIn = (file: string) =>
    problems.hardcoded.filter((line: string) => line.startsWith(`${file}:`));

describe('checkI18n, in the locale files', () => {
    it('reports a used key that a locale lacks', () => {
        expect(problems.missing).toEqual([
            'cases.missing_in_fr (absent from fr; used at src/routes/keys.svelte:6)'
        ]);
    });

    it('reports a key built from a template, which it cannot read', () => {
        expect(problems.unreadable).toEqual([
            'src/routes/keys.svelte:10: the key is not written out'
        ]);
    });

    it('reports a key defined twice, which JSON.parse would hide', () => {
        expect(problems.duplicates).toEqual(['en: cases.defined_twice (line 5)']);
    });

    it('reports a value that is not text', () => {
        expect(problems.notText).toEqual(['en: cases.not_text', 'fr: cases.not_text']);
    });

    it('reports a plural made by hand', () => {
        expect(problems.handPlurals).toEqual([
            'en: cases.hand_plural: {count} bottle(s)',
            'fr: cases.hand_plural: {count} bouteille{plural}'
        ]);
    });

    it('reports the same text under two keys in every locale, unless the pair is allowed', () => {
        expect(problems.sameText).toEqual([
            'cases.same_text, cases.same_text_again: Bottle / Bouteille'
        ]);
    });

    it('reports three dots in every locale, and straight quotes in French', () => {
        expect(problems.typography).toEqual([
            'en: cases.ellipsis: Three dots...',
            "fr: cases.apostrophe: L'apostrophe",
            'fr: cases.quotes: Les "guillemets"',
            'fr: cases.ellipsis: Trois points...'
        ]);
    });

    it('reports an unused key in one locale only, and an unused key in both', () => {
        expect(problems.oneLocaleOnly).toEqual(['cases.english_only (only in en)']);
        expect(problems.unused).toEqual(['cases.unused']);
    });
});

describe('checkI18n, hardcoded text', () => {
    it('reports text between tags', () => {
        expect(hardcodedIn('src/routes/text-between-tags.svelte')).toEqual([
            'src/routes/text-between-tags.svelte:2: Welcome to the cellar'
        ]);
    });

    it('reports a text attribute', () => {
        expect(hardcodedIn('src/routes/text-attribute.svelte')).toEqual([
            'src/routes/text-attribute.svelte:1: placeholder="Type a name"'
        ]);
    });

    it('reports a literal in an expression that the page shows, as text or text attribute', () => {
        expect(hardcodedIn('src/routes/shown-literal.svelte')).toEqual([
            "src/routes/shown-literal.svelte:1: 'Not ready yet'",
            "src/routes/shown-literal.svelte:2: 'Pick a year'"
        ]);
    });

    it('reports a label-like property', () => {
        expect(hardcodedIn('src/lib/label-property.ts')).toEqual([
            "src/lib/label-property.ts:1: label: 'Purchase date'"
        ]);
    });

    it('reports the text of a toast', () => {
        expect(hardcodedIn('src/lib/toast.ts')).toEqual([
            "src/lib/toast.ts:2: toasts.add('Wine saved'"
        ]);
    });

    it("reports the text of the browser's dialogs, in a script and in a component", () => {
        expect(hardcodedIn('src/lib/dialogs.ts')).toEqual([
            "src/lib/dialogs.ts:2: alert('Are you sure you want this'",
            "src/lib/dialogs.ts:3: confirm('Delete everything now?'",
            'src/lib/dialogs.ts:4: prompt(`Name of the case`'
        ]);
        expect(hardcodedIn('src/routes/dialogs.svelte')).toEqual([
            "src/routes/dialogs.svelte:3: confirm('Leave this page?'"
        ]);
    });

    it('reports three dots written in a component, but not a spread', () => {
        expect(hardcodedIn('src/routes/three-dots.svelte')).toEqual([
            "src/routes/three-dots.svelte:2: '...'",
            'src/routes/three-dots.svelte:3: placeholder="..."',
            'src/routes/three-dots.svelte:1: ...'
        ]);
    });

    it("reports nothing in server code, a block, another attribute or the app's own dialog", () => {
        expect(hardcodedIn('src/lib/server/log.ts')).toEqual([]);
        expect(hardcodedIn('src/routes/not-shown.svelte')).toEqual([]);
        expect(hardcodedIn('src/routes/keys.svelte')).toEqual([]);
    });
});
