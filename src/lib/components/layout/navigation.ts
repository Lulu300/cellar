import { m } from '#lib/paraglide/messages.js';

/** Whether a link of the navigation leads to the page at `pathname`, or to a page under it. */
export function isCurrentSection(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The title of a page: its section, then the sections it sits in, then the app's name, so that
 * tabs and the history tell the pages apart.
 */
export function pageTitle(...sections: string[]): string {
    return [...sections, m['navigation.wine_cellar']()].join(' - ');
}
