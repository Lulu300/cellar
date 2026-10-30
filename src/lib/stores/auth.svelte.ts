import { page } from '$app/state';

/** The seconds to wait that a 429 announces. */
const retryAfter = (response: Response) => Number(response.headers.get('Retry-After'));

function postAccessCode(body: object): Promise<Response> {
    return fetch('/api/access-code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}

class Auth {
    // Each page is rendered with the session of its request (the root +layout.server.ts), on the
    // server too, so that the first render shows the right menu and buttons. What the browser
    // learns afterwards, from a login, a logout, a 401 or checkSession(), overrides it until the
    // next full page load: a rerun of the root layout's load does not.
    #isAuthenticated = $state<boolean>();
    #accessCodeSet = $state<boolean>();

    get isAuthenticated(): boolean {
        return this.#isAuthenticated ?? page.data.authenticated;
    }

    /** False until someone chooses the first code. */
    get accessCodeSet(): boolean {
        return this.#accessCodeSet ?? page.data.accessCodeSet;
    }

    markLoggedOut() {
        this.#isAuthenticated = false;
    }

    /** Asks the server whether the session is still valid, for a page that may show a dead one. */
    async checkSession() {
        try {
            const response = await fetch('/api/session');
            if (!response.ok) return;
            const { authenticated }: { authenticated: boolean } = await response.json();
            this.#isAuthenticated = authenticated === true;
        } catch {
            // Unreachable server: the page keeps what it shows.
        }
    }

    // On success the server sets the session cookie. retryAfter (seconds) means too many attempts,
    // restoring that a restore holds the writes, a login's included, for a moment.
    async authenticate(
        code: string
    ): Promise<{ valid: boolean; retryAfter?: number; restoring?: boolean }> {
        if (typeof window === 'undefined') return { valid: false };

        try {
            const response = await postAccessCode({ code });

            if (response.status === 429) {
                return { valid: false, retryAfter: retryAfter(response) };
            }
            if (response.status === 503) {
                return { valid: false, restoring: true };
            }
            if (!response.ok) {
                return { valid: false };
            }

            const { valid }: { valid: boolean } = await response.json();
            this.#isAuthenticated = valid === true;
            return { valid: this.#isAuthenticated };
        } catch {
            return { valid: false };
        }
    }

    // First launch only. On success the server sets the session cookie; 'taken' means someone
    // else chose a code first, 'blocked' too many wrong setup tokens (retryAfter in seconds).
    async setFirstAccessCode(
        newCode: string,
        setupToken: string
    ): Promise<
        | { outcome: 'set' | 'taken' | 'wrong_token' | 'failed' }
        | { outcome: 'blocked'; retryAfter: number }
    > {
        try {
            const response = await postAccessCode({ newCode, setupToken });

            if (response.status === 409) {
                this.#accessCodeSet = true;
                return { outcome: 'taken' };
            }
            if (response.status === 403) {
                return { outcome: 'wrong_token' };
            }
            if (response.status === 429) {
                return { outcome: 'blocked', retryAfter: retryAfter(response) };
            }
            if (!response.ok) {
                return { outcome: 'failed' };
            }

            this.#accessCodeSet = true;
            this.#isAuthenticated = true;
            return { outcome: 'set' };
        } catch {
            return { outcome: 'failed' };
        }
    }

    // Updated first: the page shows the user as logged out even if the request fails.
    async logout() {
        this.markLoggedOut();
        try {
            await fetch('/api/session', { method: 'DELETE' });
        } catch {
            // Nothing to tell: the page already shows the user as logged out.
        }
    }

    // The dialog checks the new code first and turns status (none after a network error) and
    // retryAfter (seconds, after too many attempts) into a message.
    async changeAccessCode(
        currentCode: string,
        newCode: string
    ): Promise<{ success: boolean; status?: number; retryAfter?: number }> {
        try {
            const response = await fetch('/api/access-code', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentCode, newCode })
            });

            if (response.status === 429) {
                return { success: false, status: 429, retryAfter: retryAfter(response) };
            }
            return { success: response.ok, status: response.status };
        } catch {
            return { success: false };
        }
    }
}

/** Whether this browser is logged in, and whether an access code is set. */
export const auth = new Auth();
