// Header values are byte strings: Response throws on any character above U+00FF (œ, €, an emoji),
// and the route answers 500. Names stay free at creation, so the real name goes in `filename*`
// (RFC 8187), which browsers prefer, and `filename` holds an ASCII copy for older clients.

// Outside printable ASCII, the two characters that would end or escape the quoted string, and `%`,
// which some old clients percent-decode in `filename` (RFC 6266, appendix D).
// The u flag makes an emoji one replaced character instead of two halves of a surrogate pair.
const NOT_PLAIN_ASCII = /[^\x20-\x7e]|["\\%]/gu;

// encodeURIComponent leaves these as they are, but RFC 8187 does not allow them in a value.
const NOT_ATTR_CHAR = /['()*]/g;

function encodeRfc8187(value: string): string {
    return encodeURIComponent(value).replace(
        NOT_ATTR_CHAR,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

/** The Content-Disposition value that makes the browser save the response as `filename`. */
export function attachmentDisposition(filename: string): string {
    const fallback = filename.replace(NOT_PLAIN_ASCII, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc8187(filename)}`;
}

/** A response that the browser saves as `filename`. */
export function attachmentResponse(
    body: BodyInit,
    filename: string,
    contentType: string,
    headers: Record<string, string> = {}
): Response {
    return new Response(body, {
        headers: {
            ...headers,
            'Content-Type': contentType,
            'Content-Disposition': attachmentDisposition(filename)
        }
    });
}
