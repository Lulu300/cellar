import { describe, expect, it } from 'vitest';
import { NEUTRAL_HEX, startingHex } from '#lib/shared/wine-colors.js';
import { contrast, edgeColor, textColor, wineColorStyle } from './wine-color';

const WHITE = '#ffffff';
const DARK_CARD = '#000e17';
const [rouge, blanc, rose, jaune] = ['Rouge', 'Blanc', 'Rosé', 'Jaune'].map(startingHex);

describe('contrast', () => {
    it('gives the WCAG ratio, whatever the order', () => {
        expect(contrast('#000000', WHITE)).toBeCloseTo(21);
        expect(contrast(WHITE, '#000000')).toBeCloseTo(21);
        expect(contrast('#777777', '#777777')).toBe(1);
    });
});

describe('edgeColor', () => {
    it('is the colour itself when it stands out enough', () => {
        expect(edgeColor(rouge, 'light')).toBe(rouge);
        for (const hex of [blanc, rose, jaune, NEUTRAL_HEX]) {
            expect(edgeColor(hex, 'dark')).toBe(hex);
        }
    });

    // A pale white wine on the light card, a deep red on the dark one.
    it('darkens a pale colour on the light surface and lightens a dark one on the dark surface until it stands out', () => {
        for (const hex of [blanc, rose, jaune, NEUTRAL_HEX]) {
            const edge = edgeColor(hex, 'light');
            expect(edge).not.toBe(hex);
            expect(contrast(edge, WHITE)).toBeGreaterThanOrEqual(3);
        }
        const edge = edgeColor(rouge, 'dark');
        expect(contrast(rouge, DARK_CARD)).toBeLessThan(3);
        expect(contrast(edge, DARK_CARD)).toBeGreaterThanOrEqual(3);
    });

    it('gives even the colour of the surface itself a visible edge', () => {
        expect(contrast(edgeColor(WHITE, 'light'), WHITE)).toBeGreaterThanOrEqual(3);
        expect(contrast(edgeColor(DARK_CARD, 'dark'), DARK_CARD)).toBeGreaterThanOrEqual(3);
    });
});

describe('textColor', () => {
    it('writes white on a dark colour and black on a light one, at 4.5:1 at least', () => {
        expect(textColor(rouge)).toBe('#ffffff');
        for (const hex of [blanc, rose, jaune, NEUTRAL_HEX]) expect(textColor(hex)).toBe('#000000');
        for (const hex of [rouge, blanc, rose, jaune, NEUTRAL_HEX, '#777777']) {
            expect(contrast(hex, textColor(hex))).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe('wineColorStyle', () => {
    it('gives the colour, its text and its edge in each mode', () => {
        expect(wineColorStyle(blanc)).toBe(
            `--wine: ${blanc}; --wine-text: #000000; --wine-edge-light: ${edgeColor(blanc, 'light')}; --wine-edge-dark: ${blanc}`
        );
    });
});
