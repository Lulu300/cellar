import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { edgeColors } from '#lib/utils/wine-color.js';
import CaseLoad from './CaseLoad.svelte';

const RED = '#7b1e2b';
const PALE = '#ead98b';

function renderCase(colors: string[], capacity: number) {
    return render(CaseLoad, {
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
    }).body;
}

/** The opening tag of each place's drawing. */
const places = (colors: string[], capacity = 4) =>
    renderCase(colors, capacity).match(/<svg[^>]*>/g) ?? [];

describe('CaseLoad', () => {
    it('fills a place with the colour of each bottle, in order, and leaves the others empty', () => {
        const svgs = places([RED, PALE]);

        expect(svgs).toHaveLength(4);
        expect(svgs[0]).toContain(`--wine: ${RED}`);
        expect(svgs[1]).toContain(`--wine: ${PALE}`);
        for (const empty of svgs.slice(2)) {
            expect(empty).not.toContain('wine-color');
            expect(empty).toContain('text-muted-foreground');
        }
    });

    // The label lines of a bottle icon took an edge on some bottles only (FEAT-03 review).
    it('draws each place as a plain bottle, a single outline', () => {
        const body = renderCase([RED], 3);
        expect(body.match(/<path/g)).toHaveLength(3);
        expect(body).not.toMatch(/<(line|circle|rect|polyline)/);
    });

    // The pale gold of a white wine would vanish on the light card, the deep red on the dark one:
    // every filled place gets the edge of its colour, in both modes.
    it('gives every filled place the edge of its colour in each mode', () => {
        const colors = [RED, PALE];
        places(colors, 2).forEach((svg, index) => {
            const edge = edgeColors(colors[index]);
            expect(svg).toContain(`--wine-edge-light: ${edge.light}`);
            expect(svg).toContain(`--wine-edge-dark: ${edge.dark}`);
            expect(svg).toContain('text-(--wine-edge)');
        });
    });
});
