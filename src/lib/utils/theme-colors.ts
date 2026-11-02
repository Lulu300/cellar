import { m } from '#lib/paraglide/messages.js';

// Theme color definitions for the wine cellar app
export const themes = {
    blue: {
        name: m['preferences.theme_blue'],
        preview: { primary: '#3b82f6', secondary: '#f1f5f9', accent: '#e2e8f0' },
        light: {
            primary: 'oklch(0.47 0.14 226)',
            secondary: 'oklch(0.96 0.007 228)',
            accent: 'oklch(0.93 0.02 228)',
            foreground: 'oklch(0.15 0.042 228)',
            border: 'oklch(0.9 0.013 228)',
            input: 'oklch(0.65 0.02 228)',
            ring: 'oklch(0.47 0.14 226)',
            'muted-foreground': 'oklch(0.5 0.046 228)'
        },
        dark: {
            background: 'oklch(0.11 0.025 228)',
            foreground: 'oklch(0.98 0.003 228)',
            card: 'oklch(0.15 0.035 228)',
            'card-foreground': 'oklch(0.98 0.003 228)',
            popover: 'oklch(0.15 0.035 228)',
            'popover-foreground': 'oklch(0.98 0.003 228)',
            primary: 'oklch(0.6 0.18 226)',
            'primary-foreground': 'oklch(0.05 0.02 228)',
            secondary: 'oklch(0.2 0.04 228)',
            'secondary-foreground': 'oklch(0.98 0.003 228)',
            muted: 'oklch(0.2 0.04 228)',
            'muted-foreground': 'oklch(0.65 0.08 228)',
            accent: 'oklch(0.25 0.05 228)',
            'accent-foreground': 'oklch(0.98 0.003 228)',
            border: 'oklch(0.25 0.05 228)',
            input: 'oklch(0.5 0.05 228)',
            ring: 'oklch(0.6 0.18 226)'
        }
    },
    green: {
        name: m['preferences.theme_green'],
        preview: { primary: '#22c55e', secondary: '#f0fdf4', accent: '#dcfce7' },
        light: {
            primary: 'oklch(0.56 0.16 145)',
            'primary-text': 'oklch(0.5 0.16 145)',
            'primary-foreground': 'oklch(0.05 0.02 145)',
            // Dark text on the green: a darker hover would bring it under 4.5:1, so it lightens
            'primary-hover': 'color-mix(in oklab, var(--primary), white 15%)',
            secondary: 'oklch(0.96 0.007 145)',
            accent: 'oklch(0.93 0.02 145)',
            foreground: 'oklch(0.15 0.042 145)',
            border: 'oklch(0.9 0.013 145)',
            input: 'oklch(0.65 0.02 145)',
            ring: 'oklch(0.56 0.16 145)',
            'muted-foreground': 'oklch(0.5 0.046 145)'
        },
        dark: {
            background: 'oklch(0.11 0.025 145)',
            foreground: 'oklch(0.98 0.003 145)',
            card: 'oklch(0.15 0.035 145)',
            'card-foreground': 'oklch(0.98 0.003 145)',
            popover: 'oklch(0.15 0.035 145)',
            'popover-foreground': 'oklch(0.98 0.003 145)',
            primary: 'oklch(0.7 0.18 145)',
            // A light primary barely changes at app.css's 20%: a stronger mix keeps its hover visible
            'primary-hover': 'color-mix(in oklab, var(--primary), var(--foreground) 25%)',
            'primary-foreground': 'oklch(0.05 0.02 145)',
            secondary: 'oklch(0.2 0.04 145)',
            'secondary-foreground': 'oklch(0.98 0.003 145)',
            muted: 'oklch(0.2 0.04 145)',
            'muted-foreground': 'oklch(0.65 0.08 145)',
            accent: 'oklch(0.25 0.05 145)',
            'accent-foreground': 'oklch(0.98 0.003 145)',
            border: 'oklch(0.25 0.05 145)',
            input: 'oklch(0.5 0.05 145)',
            ring: 'oklch(0.7 0.18 145)'
        }
    },
    purple: {
        name: m['preferences.theme_purple'],
        preview: { primary: '#8b5cf6', secondary: '#faf5ff', accent: '#f3e8ff' },
        light: {
            primary: 'oklch(0.53 0.17 296)',
            secondary: 'oklch(0.96 0.007 296)',
            accent: 'oklch(0.93 0.02 296)',
            foreground: 'oklch(0.15 0.042 296)',
            border: 'oklch(0.9 0.013 296)',
            input: 'oklch(0.65 0.02 296)',
            ring: 'oklch(0.53 0.17 296)',
            'muted-foreground': 'oklch(0.5 0.046 296)'
        },
        dark: {
            background: 'oklch(0.11 0.025 296)',
            foreground: 'oklch(0.98 0.003 296)',
            card: 'oklch(0.15 0.035 296)',
            'card-foreground': 'oklch(0.98 0.003 296)',
            popover: 'oklch(0.15 0.035 296)',
            'popover-foreground': 'oklch(0.98 0.003 296)',
            primary: 'oklch(0.65 0.19 296)',
            'primary-foreground': 'oklch(0.05 0.02 296)',
            secondary: 'oklch(0.2 0.04 296)',
            'secondary-foreground': 'oklch(0.98 0.003 296)',
            muted: 'oklch(0.2 0.04 296)',
            'muted-foreground': 'oklch(0.65 0.08 296)',
            accent: 'oklch(0.25 0.05 296)',
            'accent-foreground': 'oklch(0.98 0.003 296)',
            border: 'oklch(0.25 0.05 296)',
            input: 'oklch(0.5 0.05 296)',
            ring: 'oklch(0.65 0.19 296)'
        }
    },
    orange: {
        name: m['preferences.theme_orange'],
        preview: { primary: '#f97316', secondary: '#fff7ed', accent: '#fed7aa' },
        light: {
            primary: 'oklch(0.65 0.15 55)',
            'primary-text': 'oklch(0.52 0.15 55)',
            'primary-foreground': 'oklch(0.05 0.02 55)',
            secondary: 'oklch(0.96 0.007 55)',
            accent: 'oklch(0.93 0.02 55)',
            foreground: 'oklch(0.15 0.042 55)',
            border: 'oklch(0.9 0.013 55)',
            input: 'oklch(0.65 0.02 55)',
            ring: 'oklch(0.65 0.15 55)',
            'muted-foreground': 'oklch(0.5 0.046 55)'
        },
        dark: {
            background: 'oklch(0.11 0.025 55)',
            foreground: 'oklch(0.98 0.003 55)',
            card: 'oklch(0.15 0.035 55)',
            'card-foreground': 'oklch(0.98 0.003 55)',
            popover: 'oklch(0.15 0.035 55)',
            'popover-foreground': 'oklch(0.98 0.003 55)',
            primary: 'oklch(0.7 0.17 55)',
            // A light primary barely changes at app.css's 20%: a stronger mix keeps its hover visible
            'primary-hover': 'color-mix(in oklab, var(--primary), var(--foreground) 25%)',
            'primary-foreground': 'oklch(0.05 0.02 55)',
            secondary: 'oklch(0.2 0.04 55)',
            'secondary-foreground': 'oklch(0.98 0.003 55)',
            muted: 'oklch(0.2 0.04 55)',
            'muted-foreground': 'oklch(0.65 0.08 55)',
            accent: 'oklch(0.25 0.05 55)',
            'accent-foreground': 'oklch(0.98 0.003 55)',
            border: 'oklch(0.25 0.05 55)',
            input: 'oklch(0.5 0.05 55)',
            ring: 'oklch(0.7 0.17 55)'
        }
    },
    red: {
        name: m['preferences.theme_red'],
        preview: { primary: '#ef4444', secondary: '#fef2f2', accent: '#fecaca' },
        light: {
            primary: 'oklch(0.55 0.22 25)',
            'primary-text': 'oklch(0.54 0.22 25)',
            secondary: 'oklch(0.96 0.007 25)',
            accent: 'oklch(0.93 0.02 25)',
            foreground: 'oklch(0.15 0.042 25)',
            border: 'oklch(0.9 0.013 25)',
            input: 'oklch(0.65 0.02 25)',
            ring: 'oklch(0.55 0.22 25)',
            'muted-foreground': 'oklch(0.5 0.046 25)'
        },
        dark: {
            background: 'oklch(0.11 0.025 25)',
            foreground: 'oklch(0.98 0.003 25)',
            card: 'oklch(0.15 0.035 25)',
            'card-foreground': 'oklch(0.98 0.003 25)',
            popover: 'oklch(0.15 0.035 25)',
            'popover-foreground': 'oklch(0.98 0.003 25)',
            primary: 'oklch(0.65 0.24 25)',
            'primary-text': 'oklch(0.67 0.24 25)',
            'primary-foreground': 'oklch(0.05 0.02 25)',
            secondary: 'oklch(0.2 0.04 25)',
            'secondary-foreground': 'oklch(0.98 0.003 25)',
            muted: 'oklch(0.2 0.04 25)',
            'muted-foreground': 'oklch(0.65 0.08 25)',
            accent: 'oklch(0.25 0.05 25)',
            'accent-foreground': 'oklch(0.98 0.003 25)',
            border: 'oklch(0.25 0.05 25)',
            input: 'oklch(0.5 0.05 25)',
            ring: 'oklch(0.65 0.24 25)'
        }
    },
    yellow: {
        name: m['preferences.theme_yellow'],
        preview: { primary: '#eab308', secondary: '#fefce8', accent: '#fef3c7' },
        light: {
            primary: 'oklch(0.7 0.14 85)',
            'primary-text': 'oklch(0.52 0.14 85)',
            'primary-foreground': 'oklch(0.05 0.02 85)',
            secondary: 'oklch(0.97 0.015 85)',
            accent: 'oklch(0.94 0.03 85)',
            foreground: 'oklch(0.15 0.042 85)',
            border: 'oklch(0.9 0.013 85)',
            input: 'oklch(0.65 0.02 85)',
            ring: 'oklch(0.7 0.14 85)',
            'muted-foreground': 'oklch(0.5 0.046 85)'
        },
        dark: {
            background: 'oklch(0.11 0.025 85)',
            foreground: 'oklch(0.98 0.003 85)',
            card: 'oklch(0.15 0.035 85)',
            'card-foreground': 'oklch(0.98 0.003 85)',
            popover: 'oklch(0.15 0.035 85)',
            'popover-foreground': 'oklch(0.98 0.003 85)',
            primary: 'oklch(0.75 0.16 85)',
            // A light primary barely changes at app.css's 20%: a stronger mix keeps its hover visible
            'primary-hover': 'color-mix(in oklab, var(--primary), var(--foreground) 30%)',
            'primary-foreground': 'oklch(0.05 0.02 85)',
            secondary: 'oklch(0.2 0.04 85)',
            'secondary-foreground': 'oklch(0.98 0.003 85)',
            muted: 'oklch(0.2 0.04 85)',
            'muted-foreground': 'oklch(0.65 0.08 85)',
            accent: 'oklch(0.25 0.05 85)',
            'accent-foreground': 'oklch(0.98 0.003 85)',
            border: 'oklch(0.25 0.05 85)',
            input: 'oklch(0.5 0.05 85)',
            ring: 'oklch(0.75 0.16 85)'
        }
    },
    rose: {
        name: m['preferences.theme_rose'],
        preview: { primary: '#f43f5e', secondary: '#fff1f2', accent: '#fecdd3' },
        light: {
            primary: 'oklch(0.55 0.21 12)',
            'primary-text': 'oklch(0.54 0.21 12)',
            secondary: 'oklch(0.96 0.007 12)',
            accent: 'oklch(0.93 0.02 12)',
            foreground: 'oklch(0.15 0.042 12)',
            border: 'oklch(0.9 0.013 12)',
            input: 'oklch(0.65 0.02 12)',
            ring: 'oklch(0.55 0.21 12)',
            'muted-foreground': 'oklch(0.5 0.046 12)'
        },
        dark: {
            background: 'oklch(0.11 0.025 12)',
            foreground: 'oklch(0.98 0.003 12)',
            card: 'oklch(0.15 0.035 12)',
            'card-foreground': 'oklch(0.98 0.003 12)',
            popover: 'oklch(0.15 0.035 12)',
            'popover-foreground': 'oklch(0.98 0.003 12)',
            primary: 'oklch(0.65 0.23 12)',
            'primary-text': 'oklch(0.66 0.23 12)',
            'primary-foreground': 'oklch(0.05 0.02 12)',
            secondary: 'oklch(0.2 0.04 12)',
            'secondary-foreground': 'oklch(0.98 0.003 12)',
            muted: 'oklch(0.2 0.04 12)',
            'muted-foreground': 'oklch(0.65 0.08 12)',
            accent: 'oklch(0.25 0.05 12)',
            'accent-foreground': 'oklch(0.98 0.003 12)',
            border: 'oklch(0.25 0.05 12)',
            input: 'oklch(0.5 0.05 12)',
            ring: 'oklch(0.65 0.23 12)'
        }
    },
    slate: {
        name: m['preferences.theme_slate'],
        preview: { primary: '#64748b', secondary: '#f8fafc', accent: '#e2e8f0' },
        light: {
            primary: 'oklch(0.48 0.013 228)',
            secondary: 'oklch(0.98 0.002 228)',
            accent: 'oklch(0.93 0.006 228)',
            foreground: 'oklch(0.09 0.005 228)',
            border: 'oklch(0.89 0.003 228)',
            input: 'oklch(0.65 0.006 228)',
            ring: 'oklch(0.48 0.013 228)',
            'muted-foreground': 'oklch(0.45 0.015 228)'
        },
        dark: {
            background: 'oklch(0.09 0.005 228)',
            foreground: 'oklch(0.98 0.003 228)',
            card: 'oklch(0.13 0.006 228)',
            'card-foreground': 'oklch(0.98 0.003 228)',
            popover: 'oklch(0.13 0.006 228)',
            'popover-foreground': 'oklch(0.98 0.003 228)',
            primary: 'oklch(0.7 0.015 228)',
            // A light primary barely changes at app.css's 20%: a stronger mix keeps its hover visible
            'primary-hover': 'color-mix(in oklab, var(--primary), var(--foreground) 25%)',
            'primary-foreground': 'oklch(0.09 0.005 228)',
            secondary: 'oklch(0.18 0.006 228)',
            'secondary-foreground': 'oklch(0.98 0.003 228)',
            muted: 'oklch(0.18 0.006 228)',
            'muted-foreground': 'oklch(0.65 0.015 228)',
            accent: 'oklch(0.22 0.007 228)',
            'accent-foreground': 'oklch(0.98 0.003 228)',
            border: 'oklch(0.22 0.007 228)',
            input: 'oklch(0.5 0.007 228)',
            ring: 'oklch(0.7 0.015 228)'
        }
    }
};

/**
 * The localStorage key of the CSS variables that applyTheme set last, which the inline script of
 * app.html sets again before the first paint, before this module has loaded.
 */
const CACHE_KEY = 'wine-cellar-theme-colors';

/** The CSS variables of a theme, in its dark or light variant. */
function themeVariables(themeId: keyof typeof themes, isDarkMode: boolean): Record<string, string> {
    const theme = themes[themeId];
    if (isDarkMode) return theme.dark;

    const colors = theme.light;
    return {
        // The light mode colours that the themes share or derive from their own
        background: 'oklch(1 0 0)',
        card: 'oklch(1 0 0)',
        'card-foreground': colors.foreground,
        popover: 'oklch(1 0 0)',
        'popover-foreground': colors.foreground,
        'primary-foreground': 'oklch(0.98 0.003 247.858)',
        'secondary-foreground': colors.foreground,
        'accent-foreground': colors.foreground,
        muted: colors.secondary,
        // Last, so that a theme can override a shared colour (a dark text on a pale primary)
        ...colors
    };
}

/** Colours the page with a theme, in its dark or light variant. */
export function applyTheme(themeId: keyof typeof themes, isDarkMode: boolean) {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    const variables = themeVariables(themeId, isDarkMode);
    // A variable set by the other mode, or by the cache of an earlier version that app.html applied,
    // would otherwise keep its value until a reload.
    for (const name of Array.from(root.style)) {
        if (name.startsWith('--') && !Object.hasOwn(variables, name.slice(2))) {
            root.style.removeProperty(name);
        }
    }
    for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(`--${name}`, value);
    }
    // The browser bar, or the title bar of the installed app, takes the colour of the header.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', variables.card);
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ dark: isDarkMode, variables }));
    } catch {
        // Without storage, only the first paint misses the theme.
    }
}
