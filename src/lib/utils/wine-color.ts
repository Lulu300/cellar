// How a wine colour is drawn: on a storage place, a badge, the stripe of a card and a chart. Any
// colour the user picks has to stay visible on the light and the dark cards, and readable as the
// background of a badge.

/**
 * How far the edge of a colour moves towards black in the light mode, and towards white in the
 * dark mode. The same for every colour, so that every edge differs from its fill alike (the
 * maintainer's choice, 2026-11-02). With the starting colours, an edge has at least 3.87:1 against
 * its card.
 */
const EDGE_AMOUNT = 0.4;

const channels = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/** The relative luminance of a `#rrggbb` colour, as WCAG defines it. */
function luminance(hex: string): number {
    const [red, green, blue] = channels(hex).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two colours, from 1 to 21. */
export function contrast(first: string, second: string): number {
    const [darker, lighter] = [luminance(first), luminance(second)].sort((a, b) => a - b);
    return (lighter + 0.05) / (darker + 0.05);
}

/** `hex` moved by `amount`, from 0 to 1, towards `target`. */
function mix(hex: string, target: string, amount: number): string {
    const to = channels(target);
    return `#${channels(hex)
        .map((channel, index) => Math.round(channel + (to[index] - channel) * amount))
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')}`;
}

/**
 * The edge of `hex` in each mode: its own hue, darker on the light card and lighter on the dark
 * one. Never the text colour, which would muddy a small shape.
 */
export const edgeColors = (hex: string) => ({
    light: mix(hex, '#000000', EDGE_AMOUNT),
    dark: mix(hex, '#ffffff', EDGE_AMOUNT)
});

/** Black or white, whichever reads better on `hex`. */
export const textColor = (hex: string): string =>
    contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff';

/**
 * The CSS variables of an element drawn in `hex`, with the class `wine-color` (app.css), which
 * picks the edge of the current mode: `--wine` the colour, `--wine-text` a text on it and
 * `--wine-edge` its edge.
 */
export function wineColorStyle(hex: string): string {
    const edge = edgeColors(hex);
    return [
        `--wine: ${hex}`,
        `--wine-text: ${textColor(hex)}`,
        `--wine-edge-light: ${edge.light}`,
        `--wine-edge-dark: ${edge.dark}`
    ].join('; ');
}
