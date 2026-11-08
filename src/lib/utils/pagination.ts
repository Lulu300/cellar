/** The page numbers that the pagination of a table shows: five at most, around the current one. */
export function pageNumbers(current: number, pageCount: number): number[] {
    const length = Math.min(5, pageCount);
    const first = Math.min(Math.max(current - 2, 1), pageCount - length + 1);
    return Array.from({ length }, (_, i) => first + i);
}

/**
 * The page to show of a list held in the browser: `page`, or the last one once the list has
 * shrunk below it (after a reload or a deletion), which would otherwise show an empty page.
 */
export function clampPage(page: number, total: number, perPage: number): number {
    return Math.min(page, Math.max(1, Math.ceil(total / perPage)));
}

/** `url` with these query parameters set, or removed for null. */
export function withQuery(url: string | URL, changes: Record<string, string | number | null>): URL {
    const changed = new URL(url);
    for (const [name, value] of Object.entries(changes)) {
        if (value === null) changed.searchParams.delete(name);
        else changed.searchParams.set(name, String(value));
    }
    return changed;
}

/** The query parameters of these changes to a list's query: a value back to its default leaves the URL. */
export function changedParams<Query extends Record<string, string>>(
    changes: Partial<Query>,
    defaults: Query
): Record<string, string | null> {
    return Object.fromEntries(
        Object.entries(changes).map(([name, value]) => [
            name,
            value === defaults[name] ? null : (value ?? null)
        ])
    );
}
