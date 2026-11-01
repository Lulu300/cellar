// How a wine colour is drawn: on a storage place, a badge, the stripe of a card and a chart. Any
// colour the user picks has to stay visible on the light and the dark surfaces, and readable as
// the background of a badge.

/** The surfaces a colour is drawn on: the card of the light mode, and that of the dark mode. */
const SURFACES = { light: '#ffffff', dark: '#000e17' } as const;

/** The least contrast of a shape with its surface (WCAG 1.4.11). */
const MIN_CONTRAST = 3;

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
 * The edge of `hex` on a surface: the colour itself when it stands out enough, otherwise the
 * same hue darkened on the light surface or lightened on the dark one until it does. Never the
 * text colour, which would muddy the drawing inside a bottle icon.
 */
export function edgeColor(hex: string, surface: keyof typeof SURFACES): string {
    const background = SURFACES[surface];
    const target = surface === 'light' ? '#000000' : '#ffffff';
    let edge = hex;
    // In steps of 5 %, as little as needed.
    for (let step = 1; step <= 20 && contrast(edge, background) < MIN_CONTRAST; step++) {
        edge = mix(hex, target, step / 20);
    }
    return edge;
}

/** Black or white, whichever reads better on `hex`. */
export const textColor = (hex: string): string =>
    contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff';

/**
 * The CSS variables of an element drawn in `hex`, with the class `wine-color` (app.css), which
 * picks the edge of the current mode: `--wine` the colour, `--wine-text` a text on it and
 * `--wine-edge` its edge.
 */
export function wineColorStyle(hex: string): string {
    return [
        `--wine: ${hex}`,
        `--wine-text: ${textColor(hex)}`,
        `--wine-edge-light: ${edgeColor(hex, 'light')}`,
        `--wine-edge-dark: ${edgeColor(hex, 'dark')}`
    ].join('; ');
}
