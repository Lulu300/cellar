import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { CalendarClock } from '@lucide/svelte';
import { describe, expect, it, vi } from 'vitest';
import { useLocale } from '../../../test/locale';
import BottleSelectionBar from './BottleSelectionBar.svelte';

const { auth } = vi.hoisted(() => ({ auth: { isAuthenticated: true } }));
vi.mock('#lib/stores/auth.svelte.js', () => ({ auth }));

const selection = (size: number) => ({ size, clear: () => {} });
// The actions of the page « À boire » and of a wine's bottles
const actions: ComponentProps<typeof BottleSelectionBar>['actions'] = [
    { label: 'Période de dégustation', icon: CalendarClock, run: () => {} },
    { label: 'Déplacer vers…', run: () => {} },
    { label: 'Changer la disponibilité des bouteilles', primary: true, run: () => {} }
];

const barOf = (size: number, list = actions) =>
    render(BottleSelectionBar, { props: { selection: selection(size), actions: list } }).body;
// The classes hold « > » (`[&>svg]`): an attribute is read whole.
const buttons = (body: string) =>
    [...body.matchAll(/<button(?:"[^"]*"|[^">])*>([\s\S]*?)<\/button>/g)].map(
        ([button, inside]) => ({
            label: inside.replace(/<[^>]*>/g, '').trim(),
            filled: button.includes('bg-primary')
        })
    );

describe('BottleSelectionBar', () => {
    it('shows nothing while no bottle is ticked', () => {
        expect(barOf(0)).not.toContain('<button');
    });

    it('counts one bottle or several, in a status read out at each change', () => {
        useLocale('fr');

        expect(barOf(1)).toMatch(/role="status"[^>]*>\s*1 bouteille sélectionnée/);
        expect(barOf(3)).toMatch(/role="status"[^>]*>\s*3 bouteilles sélectionnées/);
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

    // UI-34, choice A: a visitor sees the same bar; its actions ask for the code (whenLoggedIn).
    it('shows a visitor the same bar as a session', () => {
        useLocale('fr');
        const member = barOf(2);
        auth.isAuthenticated = false;
        const visitor = barOf(2);
        auth.isAuthenticated = true;

        expect(visitor).toBe(member);
    });
});
