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
});
