import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { plain, useLocale } from '../../../test/locale';
import CaseLoadRow from './CaseLoadRow.svelte';

describe('CaseLoadRow', () => {
    it('writes both numbers of the places used in the language of the page', () => {
        const props = { title: 'Cave', count: 1, used: 1200, capacity: 1500 };

        useLocale('en');
        expect(render(CaseLoadRow, { props }).body).toContain('1,200 of 1,500 places used');

        useLocale('fr');
        expect(plain(render(CaseLoadRow, { props }).body)).toContain(
            '1 200 emplacements utilisés sur 1 500'
        );
    });
});
