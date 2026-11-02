import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { edgeColors } from '#lib/utils/wine-color.js';
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

    // The pale gold of a white wine would vanish on the light card, the deep red on the dark one:
    // every filled place gets the edge of its colour, in both modes.
    it('gives every filled place the edge of its colour in each mode', () => {
        for (const [svg, hex] of places([RED, PALE], 2).map((svg, i) => [svg, [RED, PALE][i]])) {
            expect(svg).toContain(`--wine-edge-light: ${edgeColors(hex).light}`);
            expect(svg).toContain(`--wine-edge-dark: ${edgeColors(hex).dark}`);
            expect(svg).toContain('text-(--wine-edge)');
        }
    });
});
