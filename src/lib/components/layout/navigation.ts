import {
    Bookmark,
    ChartColumn,
    History,
    LayoutGrid,
    LogOut,
    PackageOpen,
    ScanBarcode,
    Shield,
    SlidersHorizontal,
    TrendingDown,
    Wine
} from '@lucide/svelte';
import { m } from '#lib/paraglide/messages.js';

/** A page of the menu, or the logout, the one entry that is an action. */
export interface NavItem {
    label: string;
    icon: typeof Wine;
    href?: string;
    onclick?: () => void;
    /**
     * A number shown after the label; `label` says what it counts to screen readers. On the button
     * around the menu, an `alert` shows as a red count, and a `dot` as a dot without its number.
     */
    count?: { value: number; label: string; alert?: boolean; dot?: boolean };
}

/**
 * A section of the menu: a list of pages under its name, or, when `direct`, a link to its one
 * page. A direct section becomes a list once it has several pages.
 */
export interface NavSection {
    label: string;
    items: NavItem[];
    direct?: boolean;
}

export interface NavCounts {
    authenticated: boolean;
    shortageCount: number;
    wishCount: number;
    outOfCellarCount: number;
}

/** The sections of the menu, in its order; the tools need a session, as their page does. */
export function navSections({
    authenticated,
    shortageCount,
    wishCount,
    outOfCellarCount
}: NavCounts): NavSection[] {
    const sections: NavSection[] = [
        {
            label: m['navigation.cellar'](),
            items: [
                { href: '/wines', label: m['navigation.my_wines'](), icon: Wine },
                { href: '/storage', label: m['navigation.storage'](), icon: LayoutGrid },
                {
                    href: '/out-of-cellar',
                    label: m['common.out_of_cellar'](),
                    icon: PackageOpen,
                    count: {
                        value: outOfCellarCount,
                        label: m['common.n_bottles']({ count: outOfCellarCount })
                    }
                },
                { href: '/cellar-history', label: m['navigation.history'](), icon: History }
            ]
        },
        purchasesSection(shortageCount, wishCount),
        {
            label: m['navigation.statistics'](),
            direct: true,
            items: [{ href: '/statistics', label: m['navigation.statistics'](), icon: ChartColumn }]
        }
    ];
    if (authenticated) {
        sections.push({
            label: m['navigation.tools'](),
            items: [{ href: '/barcode', label: m['navigation.barcode'](), icon: ScanBarcode }]
        });
    }
    return sections;
}

/** The purchases, whose pages are the tabs of its layout: the wishlist first. */
export function purchasesSection(shortageCount: number, wishCount: number): NavSection {
    return {
        label: m['navigation.purchases'](),
        items: [
            {
                href: '/purchases/wishlist',
                label: m['navigation.wishlist'](),
                icon: Bookmark,
                count: {
                    value: wishCount,
                    label: m['navigation.wish_count']({ count: wishCount }),
                    dot: true
                }
            },
            {
                href: '/purchases/shortage',
                label: m['navigation.shortage'](),
                icon: TrendingDown,
                count: {
                    value: shortageCount,
                    label: m['navigation.shortage_count']({ count: shortageCount }),
                    alert: true
                }
            }
        ]
    };
}

/** The pages behind the gear: the preferences, and the admin and the logout with a session. */
export function settingsSection(authenticated: boolean, logout: () => void): NavSection {
    return {
        label: m['common.settings'](),
        items: [
            { href: '/preferences', label: m['navigation.preferences'](), icon: SlidersHorizontal },
            ...(authenticated
                ? [
                      { href: '/admin', label: m['navigation.admin'](), icon: Shield },
                      { label: m['common.logout'](), icon: LogOut, onclick: logout }
                  ]
                : [])
        ]
    };
}

/**
 * What a button around these pages shows: the alert count when there is one (the wines in
 * shortage), else a dot when a page has one to show (the wishes), else nothing.
 */
export function signalOf(items: NavItem[]): NavItem['count'] {
    const counts = items.flatMap((item) =>
        item.count && item.count.value > 0 ? [item.count] : []
    );
    return counts.find((count) => count.alert) ?? counts.find((count) => count.dot);
}

/** Whether a link of the navigation leads to the page at `pathname`, or to a page under it. */
export function isCurrentSection(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether the page at `pathname` is one of the section's. */
export function isInSection(pathname: string, section: NavSection): boolean {
    return section.items.some((item) => item.href && isCurrentSection(pathname, item.href));
}

/** The paths of the tab bar of the installed app; « More » lists the other pages. */
export const TAB_BAR_PATHS = ['/wines', '/storage', '/out-of-cellar', '/purchases'];

/** The sections without the pages at or under `hrefs`, and without the sections left empty. */
export function withoutPages(sections: NavSection[], hrefs: string[]): NavSection[] {
    const kept = (item: NavItem) =>
        !item.href || !hrefs.some((href) => isCurrentSection(item.href!, href));
    return sections
        .map((section) => ({ ...section, items: section.items.filter(kept) }))
        .filter((section) => section.items.length > 0);
}

/**
 * The title of a page: its section, then the sections it sits in, then the app's name, so that
 * tabs and the history tell the pages apart.
 */
export function pageTitle(...sections: string[]): string {
    return [...sections, m['navigation.wine_cellar']()].join(' - ');
}
