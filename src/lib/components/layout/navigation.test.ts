import { describe, expect, it } from 'vitest';
import {
    isCurrentSection,
    navSections,
    settingsSection,
    signalOf,
    TAB_BAR_PATHS,
    withoutPages,
    type NavSection
} from './navigation.js';

const logout = () => {};

/** The menu as the layout builds it: the sections, then the gear. */
function menu(authenticated: boolean, shortageCount = 0, wishCount = 0): NavSection[] {
    return [
        ...navSections({ authenticated, shortageCount, wishCount, outOfCellarCount: 0 }),
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
            '/purchases/wishlist',
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
            '/purchases/wishlist',
            '/purchases/shortage',
            '/statistics',
            '/preferences'
        ]);
    });

    // The signal of Purchases: a red count, else a dot without a number, else nothing.
    it('signals the wines in shortage first, then the wishes, then nothing', () => {
        const signal = (shortage: number, wishes: number) => {
            const count = signalOf(menu(true, shortage, wishes).flatMap(({ items }) => items));
            return count && { value: count.value, alert: !!count.alert, dot: !!count.dot };
        };

        expect(signal(3, 2)).toEqual({ value: 3, alert: true, dot: false });
        expect(signal(0, 2)).toEqual({ value: 2, alert: false, dot: true });
        expect(signal(0, 0)).toBeUndefined();
    });

    // « More », in the tab bar of the installed app, lists what the tabs do not show.
    it('keeps for « More » every page that no tab leads to', () => {
        const others = withoutPages(menu(true), TAB_BAR_PATHS);

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
