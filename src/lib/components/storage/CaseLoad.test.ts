import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { edgeColors } from '#lib/utils/wine-color.js';
import { useLocale } from '../../../test/locale';
import CaseLoad from './CaseLoad.svelte';

const RED = '#7b1e2b';
const PALE = '#ead98b';

function renderCase(
    colors: string[],
    capacity: number,
    highlighted = false,
    marks: { rank: 'late' | 'this_year'; count: number }[] = []
) {
    return render(CaseLoad, {
        props: {
            highlighted,
            marks,
            storageCase: {
                id: 'a1',
                name: 'A1',
                capacity,
                containerId: 'a',
                bottles: colors.length,
                colors
            },
            onOpen: () => {}
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

    // A case is a button that opens its bottles: a screen reader hears what the drawing shows.
    it('names the case with its bottles and capacity, and says when it holds the wine looked for', () => {
        useLocale('en');
        expect(renderCase([RED, PALE], 6)).toContain('aria-label="A1: 2 of 6 bottles"');
        const highlighted = renderCase([RED], 6, true);
        expect(highlighted).toContain('aria-label="A1: 1 of 6 bottles, holds the wine shown"');
        expect(highlighted).toContain('ring-primary');
        expect(renderCase([RED], 6)).not.toContain('ring-primary');
    });

    // FEAT-05: the badges are drawn only; the name of the case says them.
    it('names the bottles to drink of the case, by rank, after what it holds', () => {
        useLocale('fr');
        const body = renderCase([RED, PALE], 6, false, [
            { rank: 'late', count: 1 },
            { rank: 'this_year', count: 1 }
        ]);

        expect(body).toContain(
            'aria-label="A1 : 2 sur 6 bouteilles. À boire : 1 en retard, 1 cette année"'
        );
        expect(renderCase([RED], 6)).not.toContain('À boire');
    });
});
