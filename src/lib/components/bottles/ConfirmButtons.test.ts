import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import ConfirmButtons from './ConfirmButtons.svelte';

describe('ConfirmButtons', () => {
    it('says that the change is on its way with the French ellipsis', () => {
        useLocale('fr');

        const { body } = render(ConfirmButtons, {
            props: { sending: true, onCancel: () => {}, onConfirm: () => {} }
        });

        expect(body).toMatch(/>\s*Mise à jour…\s*</);
    });

    // The move dialog refuses a case without room before sending anything (FEAT-04).
    it('disables Confirm only while the dialog refuses the change', () => {
        useLocale('en');
        const buttons = (refused: boolean) =>
            render(ConfirmButtons, {
                props: { sending: false, refused, onCancel: () => {}, onConfirm: () => {} }
            })
                // The opening tags, their quoted values skipped: a class holds `disabled:` too.
                .body.match(/<button(?:[^>"]|"[^"]*")*>/g)
                ?.map((tag) => /\sdisabled(?=[\s=>])/.test(tag)) ?? [];

        expect(buttons(true)).toEqual([false, true]);
        expect(buttons(false)).toEqual([false, false]);
    });
});
