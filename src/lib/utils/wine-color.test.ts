import { describe, expect, it } from 'vitest';
import { NEUTRAL_HEX, startingHex } from '#lib/shared/wine-colors.js';
import { contrast, edgeColors, textColor, wineColorStyle } from './wine-color';

const WHITE = '#ffffff';
// The card of the dark mode (app.css), the lightest of the dark cards and backgrounds.
const DARK_CARD = '#000e17';
const STARTING = [...['Rouge', 'Blanc', 'Rosé', 'Jaune'].map(startingHex), NEUTRAL_HEX];

describe('contrast', () => {
    it('gives the WCAG ratio, whatever the order', () => {
        expect(contrast('#000000', WHITE)).toBeCloseTo(21);
        expect(contrast(WHITE, '#000000')).toBeCloseTo(21);
        expect(contrast('#777777', '#777777')).toBe(1);
    });
});

describe('edgeColors', () => {
    it('darkens a colour by 40 % in the light mode and lightens it by 40 % in the dark mode', () => {
        expect(edgeColors('#7b1e2b')).toEqual({ light: '#4a121a', dark: '#b07880' });
        expect(edgeColors('#000000')).toEqual({ light: '#000000', dark: '#666666' });
    });

    // The pale white wine on the light card and the deep red on the dark one, which their fill
    // alone leaves under 3:1, get an edge that stands out; so does every other starting colour.
    it('gives every starting colour an edge of 3:1 at least on its card', () => {
        expect(contrast(startingHex('Blanc'), WHITE)).toBeLessThan(3);
        expect(contrast(startingHex('Rouge'), DARK_CARD)).toBeLessThan(3);
        for (const hex of STARTING) {
            const edge = edgeColors(hex);
            expect(contrast(edge.light, WHITE)).toBeGreaterThanOrEqual(3);
            expect(contrast(edge.dark, DARK_CARD)).toBeGreaterThanOrEqual(3);
        }
    });
});

describe('textColor', () => {
    it('writes white on a dark colour and black on a light one, at 4.5:1 at least', () => {
        expect(textColor(startingHex('Rouge'))).toBe('#ffffff');
        expect(textColor(startingHex('Blanc'))).toBe('#000000');
        for (const hex of [...STARTING, '#777777']) {
            expect(contrast(hex, textColor(hex))).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe('wineColorStyle', () => {
    it('gives the colour, its text and its edge in each mode', () => {
        expect(wineColorStyle('#ead98b')).toBe(
            '--wine: #ead98b; --wine-text: #000000; --wine-edge-light: #8c8253; --wine-edge-dark: #f2e8b9'
        );
    });
});
