import { goto } from '$app/navigation';
import { page } from '$app/state';
import { withQuery } from './pagination';

/**
 * Shows the table or list of the current page with these query parameters changed (null removes
 * one): a table's load function sorts and pages it on the server, the wine list filters itself.
 * The history entry is replaced, so that Back still leaves the page, and the scroll and the focus
 * stay where they are.
 */
export function showTablePage(changes: Record<string, string | number | null>): Promise<void> {
    return goto(withQuery(page.url.href, changes), { replace: true, reset: false });
}
