import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { CalendarClock } from '@lucide/svelte';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import BottleSelectionBar from './BottleSelectionBar.svelte';

const selection = (size: number) => ({ size, clear: () => {} });
// The actions of the page « À boire » and of a wine's bottles
const actions: ComponentProps<typeof BottleSelectionBar>['actions'] = [
    { label: 'Période de dégustation', icon: CalendarClock, run: () => {} },
    { label: 'Déplacer vers…', run: () => {} },
    { label: 'Changer la disponibilité des bouteilles', primary: true, run: () => {} }
];

const barOf = (size: number, list = actions) =>
    render(BottleSelectionBar, { props: { selection: selection(size), actions: list } }).body;
/** The count, read out by its role: its text, and whether it is only for a screen reader */
const status = (body: string) => {
    const [, attributes, text] = body.match(/<span([^>]*role="status"[^>]*)>([\s\S]*?)<\/span>/)!;
    return { text: text.trim(), unseen: /\bsr-only\b/.test(attributes) };
};
// The classes hold « > » (`[&>svg]`): an attribute is read whole.
const buttons = (body: string) =>
    [...body.matchAll(/<button(?:"[^"]*"|[^">])*>([\s\S]*?)<\/button>/g)].map(
        ([button, inside]) => ({
            label: inside.replace(/<[^>]*>/g, '').trim(),
            filled: button.includes('bg-primary')
        })
    );

describe('BottleSelectionBar', () => {
    // A live region already in the page is read out at its first change: the first tick too.
    it('keeps only its count, unseen and taking no room, while no bottle is ticked', () => {
        useLocale('fr');
        const body = barOf(0);

        expect(body).not.toContain('<button');
        // The hydration markers of Svelte aside, its root has no box
        expect(body).toMatch(/^(<!--[^>]*-->)*<div class="contents">/);
        expect(status(body)).toEqual({ text: '0 bouteille sélectionnée', unseen: true });
    });

    it('shows how many bottles are ticked, one or several', () => {
        useLocale('fr');

        expect(status(barOf(1))).toEqual({ text: '1 bouteille sélectionnée', unseen: false });
        expect(status(barOf(3))).toEqual({ text: '3 bouteilles sélectionnées', unseen: false });
    });

    it('offers to clear the selection, then the list’s actions in their order, its main one filled', () => {
        useLocale('fr');

        expect(buttons(barOf(2))).toEqual([
            { label: 'Effacer la sélection', filled: false },
            { label: 'Période de dégustation', filled: false },
            { label: 'Déplacer vers…', filled: false },
            { label: 'Changer la disponibilité des bouteilles', filled: true }
        ]);
        // A case's bar: its move is its main action
        expect(
            buttons(barOf(2, [actions[0], { ...actions[1], primary: true }])).map((b) => b.filled)
        ).toEqual([false, false, true]);
    });
});
