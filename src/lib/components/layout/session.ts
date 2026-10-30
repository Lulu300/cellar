/**
 * Whether the answer to a request means the user must give the access code. Only the hooks answer
 * 401, to a write or to the admin API without a valid session; the logout's own request is left
 * out, since the session it ends may already be gone.
 */
export function asksForAccessCode(
    status: number,
    input: RequestInfo | URL,
    init?: RequestInit
): boolean {
    if (status !== 401) return false;
    const request = input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const { pathname } = new URL(request?.url ?? String(input), 'http://localhost');
    return !(method === 'DELETE' && pathname === '/api/session');
}
