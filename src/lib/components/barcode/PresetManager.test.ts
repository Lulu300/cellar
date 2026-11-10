import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import { LabelOptions } from './label-options.svelte.js';
import PresetManager from './PresetManager.svelte';

/** The update button of the presets as the server renders it. */
const updateButton = (body: string) =>
    body.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Update preset/)?.[0];

describe('PresetManager', () => {
    it('greys the update of a preset until one is applied, and says why', () => {
        useLocale('en');
        const options = new LabelOptions(() => 'WINE');

        const { body } = render(PresetManager, { props: { presets: [], options } });

        const button = updateButton(body);
        expect(button).toMatch(/\sdisabled(?=[\s=>])/);
        // Named by the button for assistive technologies
        const [, reasonId] = button?.match(/aria-describedby="([^"]+)"/) ?? [];
        expect(body).toMatch(new RegExp(`id="${reasonId}"[^>]*>\\s*Apply a preset to update it.`));
    });

    it('names only the layout as the reason when the layout cannot be printed', () => {
        useLocale('en');
        const options = new LabelOptions(() => 'WINE');
        options.layout.labelWidth = 900;

        const { body } = render(PresetManager, { props: { presets: [], options } });

        expect(body).toContain('Only printable labels can be saved as presets:');
        expect(body).not.toContain('Apply a preset to update it.');
    });
});
