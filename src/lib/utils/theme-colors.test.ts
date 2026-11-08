import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chosenTile } from '#lib/components/layout/button-states.js';
import { applyTheme, themes } from './theme-colors.js';

// The inline script of app.html, which colours the page before the app has loaded.
const [, inlineScript] = /<script>([\s\S]*?)<\/script>/.exec(readFileSync('src/app.html', 'utf8'))!;

/** A page in a browser whose storage holds `stored`, and whose system is dark or not. */
function fakeBrowser(stored: Record<string, string>, systemIsDark = false) {
    const variables = new Map<string, string>();
    const classes = new Set<string>();
    const storage = new Map(Object.entries(stored));
    const themeColor = { content: '#ffffff' };
    const dataset: Record<string, string> = {};
    vi.stubGlobal('document', {
        querySelector: (selector: string) =>
            selector === 'meta[name="theme-color"]'
                ? { setAttribute: (_: 'content', value: string) => (themeColor.content = value) }
                : null,
        documentElement: {
            dataset,
            classList: {
                toggle: (name: string, force: boolean) =>
                    force ? classes.add(name) : classes.delete(name)
            },
            style: {
                setProperty: (name: string, value: string) => variables.set(name, value),
                removeProperty: (name: string) => variables.delete(name),
                [Symbol.iterator]: () => variables.keys()
            }
        }
    });
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
    });
    vi.stubGlobal('matchMedia', () => ({ matches: systemIsDark }));
    return { variables, classes, storage, themeColor, dataset };
}

const runInlineScript = () => new Function(inlineScript)();

/** The variables of a rule of app.css, such as `:root`. */
function appCssVariables(selector: string) {
    const css = readFileSync('src/app.css', 'utf8');
    const block = css.slice(css.indexOf(`\n${selector} {`)).split('\n}')[0];
    return new Map(
        [...block.matchAll(/(--[a-z0-9-]+): ([^;]+);/g)].map(([, name, value]) => [name, value])
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the theme before the app has loaded', () => {
    it('applies the colours that the app applied last', () => {
        const app = fakeBrowser({ 'wine-cellar-theme-mode': 'dark' });
        applyTheme('green', true);
        const stored = Object.fromEntries(app.storage);

        const reload = fakeBrowser(stored);
        runInlineScript();

        expect(reload.classes.has('dark')).toBe(true);
        expect(reload.variables).toEqual(app.variables);
        expect(reload.variables.get('--primary')).toBe('oklch(0.7 0.18 145)');
    });

    it('follows the system when the mode is not chosen', () => {
        const page = fakeBrowser({}, true);
        runInlineScript();
        expect(page.classes.has('dark')).toBe(true);

        const lightPage = fakeBrowser({ 'wine-cellar-theme-mode': 'light' }, true);
        runInlineScript();
        expect(lightPage.classes.has('dark')).toBe(false);
    });

    it('leaves the colours of the other mode to the app', () => {
        const app = fakeBrowser({});
        applyTheme('green', true);
        const stored = Object.fromEntries(app.storage);

        // The system turned light since the colours were saved.
        const reload = fakeBrowser(stored, false);
        runInlineScript();

        expect(reload.classes.has('dark')).toBe(false);
        expect(reload.variables.size).toBe(0);
    });

    it('colours the browser bar like the header, in the chosen mode', () => {
        // The system is light, but the user chose the dark mode.
        const app = fakeBrowser({ 'wine-cellar-theme-mode': 'dark' });
        applyTheme('green', true);
        expect(app.themeColor.content).toBe(themes.green.dark.card);

        const reload = fakeBrowser(Object.fromEntries(app.storage));
        runInlineScript();
        expect(reload.themeColor.content).toBe(themes.green.dark.card);

        applyTheme('green', false);
        expect(reload.themeColor.content).toBe('oklch(1 0 0)');
    });

    it('still loads when the storage cannot be read', () => {
        fakeBrowser({});
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            }
        });
        expect(runInlineScript).not.toThrow();
    });
});

// app.css draws the frame of the pages from these, before the app has loaded too.
describe('the page width before the app has loaded', () => {
    it('applies the stored width and cellar map switch', () => {
        const page = fakeBrowser({
            'wine-cellar-page-width': 'narrow',
            'wine-cellar-cellar-map-full-width': 'false'
        });
        runInlineScript();
        expect(page.dataset).toEqual({ pageWidth: 'narrow', cellarMapFullWidth: 'false' });
    });

    it('applies them even when the colour cache does not parse', () => {
        const page = fakeBrowser({
            'wine-cellar-theme-colors': '{corrupt',
            'wine-cellar-page-width': 'full'
        });
        runInlineScript();
        expect(page.dataset.pageWidth).toBe('full');
    });

    it('leaves the defaults to app.css when nothing is stored', () => {
        const page = fakeBrowser({});
        runInlineScript();
        expect(page.dataset).toEqual({ pageWidth: '', cellarMapFullWidth: '' });
    });
});

/** The variables that applyTheme sets on a page that it has not coloured yet. */
function variablesOf(themeId: keyof typeof themes, isDarkMode: boolean) {
    const page = fakeBrowser({});
    applyTheme(themeId, isDarkMode);
    return page.variables;
}

/** Every theme, in light and in dark mode. */
const everyThemeAndMode = (Object.keys(themes) as (keyof typeof themes)[]).flatMap((themeId) => [
    [themeId, false] as const,
    [themeId, true] as const
]);

describe('switching between dark and light', () => {
    it.each(everyThemeAndMode)(
        'gives the colours of a reload, with the %s theme (dark: %s)',
        (themeId, isDarkMode) => {
            const reload = variablesOf(themeId, isDarkMode);

            const page = fakeBrowser({});
            applyTheme(themeId, !isDarkMode);
            applyTheme(themeId, isDarkMode);

            expect(page.variables).toEqual(reload);
        }
    );

    it('drops a colour that an earlier version cached', () => {
        // Before 0.12.0, the themes set --destructive, too dark for the dark mode.
        const cache = { dark: true, variables: { destructive: 'oklch(0.577 0.245 27.325)' } };
        const page = fakeBrowser({
            'wine-cellar-theme-mode': 'dark',
            'wine-cellar-theme-colors': JSON.stringify(cache)
        });
        runInlineScript();
        expect(page.variables.has('--destructive')).toBe(true);

        applyTheme('blue', true);

        expect(page.variables.has('--destructive')).toBe(false);
    });
});

describe('the default theme', () => {
    // app.css colours the page before any theme is applied: blue must give the same colours.
    it.each([
        [':root', false],
        ['.dark', true]
    ])('applies the colours of %s in app.css', (selector, isDarkMode) => {
        const css = appCssVariables(selector);
        for (const [name, value] of variablesOf('blue', isDarkMode)) {
            expect([name, value]).toEqual([name, css.get(name)]);
        }
    });
});

describe('the contrast of every theme', () => {
    /** The OKLab coordinates of an `oklch(L C H)` colour. */
    function oklab(color: string) {
        const [l, c, h] = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(color)!.slice(1).map(Number);
        return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
    }

    /** The sRGB channels (0 to 1) of OKLab coordinates, clipped to the sRGB gamut. */
    function labToSrgb([l, a, b]: number[]) {
        const lms = [
            l + 0.3963377774 * a + 0.2158037573 * b,
            l - 0.1055613458 * a - 0.0638541728 * b,
            l - 0.0894841775 * a - 1.291485548 * b
        ].map((value) => value ** 3);
        return [
            [4.0767416621, -3.3077115913, 0.2309699292],
            [-1.2684380046, 2.6097574011, -0.3413193965],
            [-0.0041960863, -0.7034186147, 1.707614701]
        ]
            .map((row) =>
                Math.min(1, Math.max(0, row[0] * lms[0] + row[1] * lms[1] + row[2] * lms[2]))
            )
            .map((linear) =>
                linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055
            );
    }

    /** The sRGB channels (0 to 1) of an `oklch(L C H)` colour, clipped to the sRGB gamut. */
    const srgb = (color: string) => labToSrgb(oklab(color));

    /** The WCAG relative luminance of sRGB channels. */
    function luminance(channels: number[]) {
        const [red, green, blue] = channels.map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        );
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }

    function contrast(first: number[], second: number[]) {
        const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /** `color` at `alpha` over `background`, as the browser paints `bg-destructive/10`. */
    function tint(color: number[], background: number[], alpha: number) {
        return color.map((value, i) => alpha * value + (1 - alpha) * background[i]);
    }

    // WCAG: 4.5:1 for text, 3:1 for the border of a field.
    it.each(everyThemeAndMode)(
        'is readable with the %s theme (dark: %s)',
        (themeId, isDarkMode) => {
            const color = Object.fromEntries(variablesOf(themeId, isDarkMode));
            for (const name of ['primary', 'secondary', 'accent']) {
                const ratio = contrast(
                    srgb(color[`--${name}-foreground`]),
                    srgb(color[`--${name}`])
                );
                expect(ratio, name).toBeGreaterThanOrEqual(4.5);
            }
            // A text in the theme colour, also on the accent of a hovered or active row. app.css
            // falls back to --primary for a theme without --primary-text.
            const text = color['--primary-text'] ?? color['--primary'];
            for (const surface of ['background', 'card', 'popover', 'muted', 'accent']) {
                expect(
                    contrast(srgb(text), srgb(color[`--${surface}`])),
                    `primary-text on ${surface}`
                ).toBeGreaterThanOrEqual(4.5);
            }
            expect(
                contrast(srgb(color['--input']), srgb(color['--background'])),
                'input'
            ).toBeGreaterThanOrEqual(3);
        }
    );

    // A chosen tile: a tint of the primary that gets stronger under the pointer, where its grey
    // hints may take the text colour.
    const classes = chosenTile.split(' ');
    const percent = (prefix: string) =>
        Number(classes.find((c) => c.startsWith(prefix))!.slice(prefix.length)) / 100;
    const chosenTileTint = percent('bg-primary/');
    const chosenTileHoverTint = percent('hover:bg-primary/');
    const chosenTileHintTakesText = classes.includes(
        'hover:[&_.text-muted-foreground]:text-foreground'
    );

    // UI-33: the hover of a filled button changes its fill by 1.2:1 at least, as much as the
    // hover it replaced, and keeps its text readable; a quiet button's accent shows on a card and
    // on the page.
    it.each(everyThemeAndMode)(
        'shows the hover of every button with the %s theme (dark: %s)',
        (themeId, isDarkMode) => {
            const color = Object.fromEntries(variablesOf(themeId, isDarkMode));
            const css = appCssVariables(':root');
            const darkCss = appCssVariables('.dark');
            /** `color-mix(in oklab, var(--fill), var(--text) N%)`, or `white` for the text. */
            function hover(name: string) {
                const mix =
                    color[`--${name}-hover`] ??
                    (isDarkMode ? darkCss.get(`--${name}-hover`) : undefined) ??
                    css.get(`--${name}-hover`)!;
                const [, fill, towards, percent] =
                    /^color-mix\(in oklab, var\(--([a-z-]+)\), (?:var\(--([a-z-]+)\)|white) (\d+)%\)$/.exec(
                        mix
                    )!;
                const [from, to] = [
                    oklab(color[`--${fill}`]),
                    oklab(towards ? color[`--${towards}`] : 'oklch(1 0 0)')
                ];
                return labToSrgb(
                    from.map((value, i) => value + (to[i] - value) * (Number(percent) / 100))
                );
            }
            for (const name of ['primary', 'secondary']) {
                const fill = srgb(color[`--${name}`]);
                expect(contrast(fill, hover(name)), `${name} hover`).toBeGreaterThanOrEqual(1.2);
                expect(
                    contrast(srgb(color[`--${name}-foreground`]), hover(name)),
                    `text on the ${name} hover`
                ).toBeGreaterThanOrEqual(4.5);
            }
            const primary = srgb(color['--primary']);
            const hint = srgb(color['--muted-foreground']);
            const hintOnHover = chosenTileHintTakesText ? srgb(color['--foreground']) : hint;
            for (const surface of ['card', 'background']) {
                const under = srgb(color[`--${surface}`]);
                expect(
                    contrast(srgb(color['--accent']), under),
                    `accent on ${surface}`
                ).toBeGreaterThanOrEqual(1.15);
                const [tile, hoveredTile] = [chosenTileTint, chosenTileHoverTint].map((alpha) =>
                    tint(primary, under, alpha)
                );
                expect(
                    contrast(tile, hoveredTile),
                    `chosen tile hover on ${surface}`
                ).toBeGreaterThanOrEqual(1.2);
                expect(
                    contrast(hint, tile),
                    `hint on a chosen tile on ${surface}`
                ).toBeGreaterThanOrEqual(4.5);
                expect(
                    contrast(hintOnHover, hoveredTile),
                    `hint on the chosen tile hover on ${surface}`
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    );

    // An error, success or warning box writes in its colour on a tint of that colour, in every
    // theme: the same variables, on the page background of app.css.
    it.each([':root', '.dark'])('keeps status text readable on its own tint (%s)', (selector) => {
        const css = appCssVariables(selector);
        const background = srgb(css.get('--background')!);
        for (const name of ['destructive', 'success', 'warning']) {
            const text = srgb(css.get(`--${name}`)!);
            expect(contrast(text, tint(text, background, 0.1)), name).toBeGreaterThanOrEqual(4.5);
        }
    });
});
