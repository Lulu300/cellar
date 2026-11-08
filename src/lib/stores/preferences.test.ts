import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));

const stored = new Map<string, string>();
const systemScheme = { matches: false, addEventListener: vi.fn() };

beforeEach(() => {
    vi.resetModules();
    stored.clear();
    systemScheme.matches = false;
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value)
    });
    vi.stubGlobal('matchMedia', () => systemScheme);
    vi.stubGlobal('addEventListener', vi.fn());
});

async function loadPreferences() {
    const { preferences } = await import('./preferences.svelte');
    return preferences;
}

describe('preferences', () => {
    it('reads the choices that earlier versions stored', async () => {
        stored.set('wine-cellar-theme', 'green');
        stored.set('wine-cellar-theme-mode', 'dark');
        stored.set('wine-cellar-show-images', 'false');
        stored.set('wine-cellar-wine-list-view', 'list');
        stored.set('wine-cellar-storage-view-mode', 'grid');
        stored.set('wine-cellar-containers-layout', 'false');

        const preferences = await loadPreferences();
        expect(preferences.theme).toBe('green');
        expect(preferences.isDark).toBe(true);
        expect(preferences.showImages).toBe(false);
        expect(preferences.wineListView).toBe('list');
        expect(preferences.storageViewMode).toBe('grid');
        expect(preferences.containersAsColumns).toBe(false);
    });

    it('falls back to the defaults for missing or unknown values', async () => {
        stored.set('wine-cellar-theme', 'toString');
        stored.set('wine-cellar-theme-mode', 'sepia');
        stored.set('wine-cellar-wine-list-view', 'later');
        stored.set('wine-cellar-drinking-horizon', 'ten_years');

        const preferences = await loadPreferences();
        expect(preferences.theme).toBe('blue');
        expect(preferences.themeMode).toBe('system');
        expect(preferences.showImages).toBe(true);
        expect(preferences.wineListView).toBe('cards');
        expect(preferences.storageViewMode).toBe('table');
        expect(preferences.containersAsColumns).toBe(true);
        expect(preferences.drinkingHorizon).toBe('this_year');
        expect(preferences.showDrinkingMarker).toBe(false);
        expect(preferences.pageWidth).toBe('normal');
        expect(preferences.cellarMapFullWidth).toBe(true);
    });

    it.each(['narrow', 'normal', 'wide', 'full'])('reads the page width %s', async (width) => {
        stored.set('wine-cellar-page-width', width);
        const preferences = await loadPreferences();
        expect(preferences.pageWidth).toBe(width);
    });

    it('reads an unknown page width as the normal one', async () => {
        stored.set('wine-cellar-page-width', 'huge');
        const preferences = await loadPreferences();
        expect(preferences.pageWidth).toBe('normal');
    });

    it('keeps the cellar map in the frame only when told so', async () => {
        stored.set('wine-cellar-cellar-map-full-width', 'false');
        const preferences = await loadPreferences();
        expect(preferences.cellarMapFullWidth).toBe(false);
        preferences.set('cellarMapFullWidth', true);
        expect(stored.get('wine-cellar-cellar-map-full-width')).toBe('true');
    });

    it('reads the horizon and the marker of the bottles to drink', async () => {
        stored.set('wine-cellar-drinking-horizon', 'two_years');
        stored.set('wine-cellar-drinking-marker', 'true');

        const preferences = await loadPreferences();
        expect(preferences.drinkingHorizon).toBe('two_years');
        expect(preferences.showDrinkingMarker).toBe(true);
    });

    it('follows the system in the system mode', async () => {
        systemScheme.matches = true;
        const preferences = await loadPreferences();
        expect(preferences.isDark).toBe(true);
        preferences.set('themeMode', 'light');
        expect(preferences.isDark).toBe(false);
    });

    it('stores a change under the key that earlier versions read', async () => {
        const preferences = await loadPreferences();
        preferences.set('showImages', false);
        preferences.set('theme', 'purple');
        expect(stored.get('wine-cellar-show-images')).toBe('false');
        expect(stored.get('wine-cellar-theme')).toBe('purple');
        expect(preferences.theme).toBe('purple');
    });

    // A browser that blocks the site's cookies and data throws a SecurityError on any use of
    // localStorage, which used to stop the page's controls from answering (audit a5 m10).
    it('keeps working when the browser refuses the storage', async () => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() {
                throw new DOMException('Access is denied for this document.', 'SecurityError');
            }
        });

        const preferences = await loadPreferences();
        expect(preferences.theme).toBe('blue');
        expect(preferences.showImages).toBe(true);

        preferences.set('showImages', false);
        expect(preferences.showImages).toBe(false);
    });
});
