import { describe, expect, it, vi } from 'vitest';
import { moveChoice } from './arrow-keys';

/** A group of choices of `role`, as the page has them: each one knows its group. */
function group(role: 'radio' | 'tab', names: string[]) {
    const container = {
        role: role === 'tab' ? 'tablist' : 'radiogroup',
        querySelectorAll: (selector: string) => (selector === `[role="${role}"]` ? choices : [])
    };
    const choices = names.map((name) => ({
        name,
        getAttribute: (attribute: string) => (attribute === 'role' ? role : null),
        closest: (selector: string) =>
            selector === `[role="${container.role}"]` ? container : null,
        focus: vi.fn(),
        click: vi.fn()
    }));
    return choices;
}

/** Presses `key` on `choice`; the choice that took the focus, if any. */
function press(choices: ReturnType<typeof group>, from: number, key: string, choose = true) {
    const event = {
        key,
        currentTarget: choices[from],
        preventDefault: vi.fn()
    } as unknown as KeyboardEvent;
    moveChoice(event, choose);
    const focused = choices.find((choice) => choice.focus.mock.calls.length > 0);
    const clicked = choices.find((choice) => choice.click.mock.calls.length > 0);
    return { focused: focused?.name, clicked: clicked?.name, prevented: event.preventDefault };
}

const PARTS = ['ready', 'cellar', 'settle', 'ignored'];

describe('the keys of a tab list (UI-38)', () => {
    it('move to the next or previous tab and show it, round past either end', () => {
        expect(press(group('tab', PARTS), 0, 'ArrowRight')).toMatchObject({
            focused: 'cellar',
            clicked: 'cellar'
        });
        expect(press(group('tab', PARTS), 3, 'ArrowRight').focused).toBe('ready');
        expect(press(group('tab', PARTS), 0, 'ArrowLeft').focused).toBe('ignored');
        expect(press(group('tab', PARTS), 2, 'ArrowLeft').focused).toBe('cellar');
    });

    it('go to the first tab with Home and the last with End', () => {
        expect(press(group('tab', PARTS), 2, 'Home').clicked).toBe('ready');
        expect(press(group('tab', PARTS), 1, 'End').clicked).toBe('ignored');
    });

    it('leave the other keys, Tab included, to the browser', () => {
        for (const key of ['Tab', 'Enter', ' ', 'a']) {
            const { focused, prevented } = press(group('tab', PARTS), 1, key);
            expect(focused).toBeUndefined();
            expect(prevented).not.toHaveBeenCalled();
        }
    });
});

describe('the keys of a radio group', () => {
    it('move within the group, choosing only when asked', () => {
        const languages = group('radio', ['en', 'fr']);
        expect(press(languages, 0, 'ArrowDown', false)).toEqual({
            focused: 'fr',
            clicked: undefined,
            prevented: expect.anything()
        });
        expect(press(group('radio', ['light', 'dark', 'system']), 2, 'ArrowUp').clicked).toBe(
            'dark'
        );
    });
});
