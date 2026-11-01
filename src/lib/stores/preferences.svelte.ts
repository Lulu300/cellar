import { browser } from '$app/env';
import { themes } from '#lib/utils/theme-colors.js';
import type { WineListView } from '#lib/utils/wine-filters.js';

export type ThemeId = keyof typeof themes;
type ThemeMode = 'light' | 'dark' | 'system';

// The localStorage keys of the earlier versions, so that users keep their choices.
const KEYS = {
    theme: 'wine-cellar-theme',
    themeMode: 'wine-cellar-theme-mode',
    showImages: 'wine-cellar-show-images',
    wineListView: 'wine-cellar-wine-list-view',
    storageViewMode: 'wine-cellar-storage-view-mode',
    containersAsColumns: 'wine-cellar-containers-layout'
} as const;

type PreferenceName = keyof typeof KEYS;

/**
 * The display preferences of this browser, kept in localStorage. On the server, which cannot read
 * them, and in a browser that refuses the site's storage, each one has its default.
 */
class Preferences {
    theme = $state<ThemeId>('blue');
    themeMode = $state<ThemeMode>('system');
    /** Whether the wine list and the shortage page show the images of the wines at first. */
    showImages = $state(true);
    /** The view the wine list opens in, when its URL names none. */
    wineListView = $state<WineListView>('cards');
    storageViewMode = $state<'table' | 'grid'>('table');
    /** Whether the storage table shows the containers as columns, or as rows. */
    containersAsColumns = $state(true);

    #systemIsDark = $state(false);
    /** The 'system' mode follows the colour scheme of the system, also when it changes. */
    readonly isDark = $derived(
        this.themeMode === 'system' ? this.#systemIsDark : this.themeMode === 'dark'
    );

    constructor() {
        if (!browser) return;
        this.#read();
        const scheme = matchMedia('(prefers-color-scheme: dark)');
        this.#systemIsDark = scheme.matches;
        scheme.addEventListener('change', (event) => (this.#systemIsDark = event.matches));
        // A preference changed in another tab
        addEventListener('storage', (event) => {
            if (event.key === null || Object.values(KEYS).some((key) => key === event.key)) {
                this.#read();
            }
        });
    }

    #read() {
        // A browser that blocks the site's data throws on any use of localStorage: the defaults
        // apply then, as on a first visit.
        const stored = (name: PreferenceName) => {
            try {
                return localStorage.getItem(KEYS[name]);
            } catch {
                return null;
            }
        };
        const theme = stored('theme');
        this.theme = theme !== null && Object.hasOwn(themes, theme) ? (theme as ThemeId) : 'blue';
        const mode = stored('themeMode');
        this.themeMode = mode === 'light' || mode === 'dark' ? mode : 'system';
        this.showImages = stored('showImages') !== 'false';
        this.wineListView = stored('wineListView') === 'list' ? 'list' : 'cards';
        this.storageViewMode = stored('storageViewMode') === 'grid' ? 'grid' : 'table';
        this.containersAsColumns = stored('containersAsColumns') !== 'false';
    }

    /** Changes a preference and keeps it for the next visits, or for this page if it cannot. */
    set<Name extends PreferenceName>(name: Name, value: this[Name]) {
        this[name] = value;
        try {
            localStorage.setItem(KEYS[name], String(value));
        } catch {
            // Blocked or full storage: the choice holds until the page is reloaded.
        }
    }
}

export const preferences = new Preferences();
