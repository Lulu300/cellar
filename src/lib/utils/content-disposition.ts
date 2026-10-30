// One parameter: `; name=` then a quoted string (escapes included) or a token. The sticky flag
// matches the parameters one after the other from the first `;`, so text inside a quoted value,
// such as a name holding `filename*=`, is never read as a parameter of its own.
const PARAMETER = /;\s*([^\s=;]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;]*))\s*/gy;
const UTF8_VALUE = /^UTF-8'[^']*'(.*)$/i;

/** The parameters of a header value, by lower-case name; the first one wins when a name repeats. */
function parameters(header: string): Map<string, string> {
    const params = new Map<string, string>();
    const start = header.indexOf(';');
    if (start === -1) return params;

    for (const [, name, quoted, token] of header.slice(start).matchAll(PARAMETER)) {
        const key = name.toLowerCase();
        if (!params.has(key)) {
            params.set(key, quoted !== undefined ? quoted.replace(/\\(.)/g, '$1') : token);
        }
    }
    return params;
}

/**
 * The file name that a Content-Disposition header gives, or null when it gives none.
 * `filename*` is read first: it holds the real name, while `filename` may be an ASCII copy of it.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
    if (!header) return null;
    const params = parameters(header);

    const extended = UTF8_VALUE.exec(params.get('filename*') ?? '');
    if (extended) {
        try {
            return decodeURIComponent(extended[1]);
        } catch {
            // Malformed percent-encoding: the plain name is still usable.
        }
    }
    return params.get('filename') || null;
}
