import { describe, expect, it } from 'vitest';
import {
    alertOf,
    isCurrentSection,
    navSections,
    settingsSection,
    withoutPages,
    type NavSection
} from './navigation.js';

const logout = () => {};

/** The menu as the layout builds it: the sections, then the gear. */
function menu(authenticated: boolean, shortageCount = 0): NavSection[] {
    return [
        ...navSections({ authenticated, shortageCount, outOfCellarCount: 0 }),
        settingsSection(authenticated, logout)
    ];
}

const hrefs = (sections: NavSection[]) =>
    sections.flatMap((section) => section.items.map((item) => item.href ?? 'logout'));

describe('isCurrentSection', () => {
    it('matches the page of the link and the pages under it', () => {
        expect(isCurrentSection('/wines', '/wines')).toBe(true);
        expect(isCurrentSection('/wines/42', '/wines')).toBe(true);
        expect(isCurrentSection('/admin/settings', '/admin')).toBe(true);
    });

    it('does not match a page whose path only starts with the same letters', () => {
        expect(isCurrentSection('/wine-shortage', '/wines')).toBe(false);
        expect(isCurrentSection('/wines-archive', '/wines')).toBe(false);
        expect(isCurrentSection('/storage', '/wines')).toBe(false);
    });
});

describe('the menu', () => {
    // Every page of the menu before the sections (UI-28) is still in it.
    it('leads to every page, the tools, the admin and the logout only with a session', () => {
        expect(hrefs(menu(true))).toEqual([
            '/wines',
            '/storage',
            '/out-of-cellar',
            '/cellar-history',
            '/purchases/shortage',
            '/statistics',
            '/barcode',
            '/preferences',
            '/admin',
            'logout'
        ]);
        expect(hrefs(menu(false))).toEqual([
            '/wines',
            '/storage',
            '/out-of-cellar',
            '/cellar-history',
            '/purchases/shortage',
            '/statistics',
            '/preferences'
        ]);
    });

    it('signals the wines in shortage, and nothing without any', () => {
        expect(alertOf(menu(true, 3))?.value).toBe(3);
        expect(alertOf(menu(true, 0))?.value).toBe(0);
    });

    // « More », in the tab bar of the installed app, lists what the tabs do not show.
    it('keeps for « More » every page that no tab leads to', () => {
        const tabs = ['/wines', '/storage', '/out-of-cellar', '/purchases'];
        const others = withoutPages(menu(true), tabs);

        expect(hrefs(others)).toEqual([
            '/cellar-history',
            '/statistics',
            '/barcode',
            '/preferences',
            '/admin',
            'logout'
        ]);
        expect(others.map((section) => section.items.length)).not.toContain(0);
    });
});
