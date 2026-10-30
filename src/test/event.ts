import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { Session } from '#lib/server/db/schema.js';

let lastClient = 0;

/** An address no earlier call returned: the attempt limits are kept for the whole test file. */
export function newClient(): string {
    lastClient += 1;
    return `10.0.${Math.floor(lastClient / 256)}.${lastClient % 256}`;
}

type CookieOptions = Parameters<Cookies['set']>[2];

export interface FakeCookies extends Cookies {
    /** The options of the last set or delete of each cookie. */
    options: Map<string, CookieOptions>;
}

function notUsed(): never {
    throw new Error('Not used by the code under test');
}

/** The cookie jar of one browser, kept across the requests that share it. */
export function fakeCookies(): FakeCookies {
    const values = new Map<string, string>();
    const options = new Map<string, CookieOptions>();
    return {
        options,
        get: (name) => values.get(name),
        getAll: () => [...values].map(([name, value]) => ({ name, value })),
        set: (name, value, opts) => {
            values.set(name, value);
            options.set(name, opts);
        },
        delete: (name, opts) => {
            values.delete(name);
            options.set(name, opts);
        },
        serialize: notUsed,
        parse: notUsed
    };
}

interface EventInit {
    method?: string;
    path?: string;
    /** What the router matched, null when no route did. */
    routeId?: string | null;
    /** The values of the route's parameters, such as `id` in /api/bottles/[id]. */
    params?: Record<string, string>;
    /** Sent as JSON, or as is when it is already a string, a form, a file or a stream. */
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Cookies;
    session?: Session | null;
    client?: string;
}

/**
 * The parts of a RequestEvent that the hooks and handlers read. `Event` lets a test pass the
 * result straight to a handler typed with its route's own RequestEvent.
 */
export function fakeEvent<Event = RequestEvent>({
    method = 'GET',
    path = '/',
    routeId = null,
    params = {},
    body,
    headers = {},
    cookies = fakeCookies(),
    session = null,
    client = '192.168.1.20'
}: EventInit = {}): Event {
    const url = new URL(path, 'http://localhost');
    const asIs =
        body === undefined ||
        typeof body === 'string' ||
        body instanceof FormData ||
        body instanceof Blob ||
        body instanceof ReadableStream;
    // A file is sent with its own type, as fetch does.
    const request = new Request(url, {
        method,
        headers: asIs ? headers : { 'content-type': 'application/json', ...headers },
        body: asIs ? body : JSON.stringify(body),
        // Required for a stream, which is sent as it is read.
        duplex: 'half'
    } as RequestInit);
    return {
        request,
        url,
        route: { id: routeId },
        params,
        cookies,
        locals: { session },
        getClientAddress: () => client
    } as unknown as Event;
}

/**
 * `form` encoded as a browser sends it, with the Content-Length that fakeEvent cannot compute for a
 * FormData body: the headers to pass along with the body.
 */
export async function encodedForm(
    form: FormData
): Promise<{ body: Blob; headers: Record<string, string> }> {
    const encoded = new Response(form);
    const body = await encoded.blob();
    return {
        body,
        headers: {
            'content-type': encoded.headers.get('content-type') ?? '',
            'content-length': String(body.size)
        }
    };
}
