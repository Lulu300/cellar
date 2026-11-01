import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { edgeColor } from '#lib/utils/wine-color.js';
import CaseLoad from './CaseLoad.svelte';

const RED = '#7b1e2b';
const PALE = '#ead98b';

function places(colors: string[], capacity = 4) {
    const { body } = render(CaseLoad, {
        props: {
            storageCase: {
                id: 'a1',
                name: 'A1',
                capacity,
                containerId: 'a',
                bottles: colors.length,
                colors
            }
        }
    });
    return body.match(/<svg[^>]*>/g) ?? [];
}

describe('CaseLoad', () => {
    it('fills a place with the colour of each bottle, in order, and leaves the others empty', () => {
        const svgs = places([RED, PALE]);

        expect(svgs).toHaveLength(4);
        expect(svgs[0]).toContain(`--wine: ${RED}`);
        expect(svgs[1]).toContain(`--wine: ${PALE}`);
        for (const empty of svgs.slice(2)) {
            expect(empty).not.toContain('--wine');
            expect(empty).toContain('fill="none"');
        }
    });

    // The pale gold of a white wine would vanish on the light card, the deep red on the dark one.
    it('gives a place the edge of its colour in each mode', () => {
        const [pale] = places([PALE], 1);
        expect(pale).toContain(`--wine-edge-light: ${edgeColor(PALE, 'light')}`);
        expect(pale).toContain(`--wine-edge-dark: ${PALE}`);
        expect(pale).toContain('text-(--wine-edge)');
    });
});
