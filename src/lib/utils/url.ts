const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns the URL if it is an absolute http(s) URL, otherwise null.
 * Use it before binding any stored URL to an `href`: it blocks
 * `javascript:`, `data:`, `vbscript:` and every other scheme.
 */
export function safeUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return null;
    }

    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
}

/**
 * Server-side check for an optional website field.
 * Empty values (undefined, null, '') are allowed; anything else must be an http(s) URL.
 */
export function isValidOptionalWebsite(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return safeUrl(value) !== null;
}

export const INVALID_WEBSITE_ERROR = 'Invalid website: only http:// and https:// URLs are allowed';
