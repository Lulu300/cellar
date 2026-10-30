import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, themes } from './theme-colors.js';

// The inline script of app.html, which colours the page before the app has loaded.
const [, inlineScript] = /<script>([\s\S]*?)<\/script>/.exec(readFileSync('src/app.html', 'utf8'))!;

/** A page in a browser whose storage holds `stored`, and whose system is dark or not. */
function fakeBrowser(stored: Record<string, string>, systemIsDark = false) {
    const variables = new Map<string, string>();
    const classes = new Set<string>();
    const storage = new Map(Object.entries(stored));
    vi.stubGlobal('document', {
        documentElement: {
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
    return { variables, classes, storage };
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
    /** The sRGB channels (0 to 1) of an `oklch(L C H)` colour, clipped to the sRGB gamut. */
    function srgb(color: string) {
        const [l, c, h] = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(color)!.slice(1).map(Number);
        const a = c * Math.cos((h * Math.PI) / 180);
        const b = c * Math.sin((h * Math.PI) / 180);
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
