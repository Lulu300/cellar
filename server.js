// Starts the built app (`node server.js`): adapter-node's build/index.js, plus the ORIGIN variable.
//
// adapter-node 6 no longer reads ORIGIN. The origin it trusts, `paths.origin`, is fixed when the app
// is built, but one Docker image serves every installation. Without it, adapter-node takes the
// origin from the Host header and assumes https, so on a plain http address every write fails
// SvelteKit's CSRF check (403). ORIGIN therefore goes through adapter-node's PROTOCOL_HEADER and
// HOST_HEADER: this file sets those two headers on every request from ORIGIN, overwriting whatever
// the client sent. As with adapter-node 5, ORIGIN wins over the reverse-proxy variables.
import process from 'node:process';

const PROTOCOL_HEADER = 'x-cellar-origin-protocol';
const HOST_HEADER = 'x-cellar-origin-host';

/** Same checks and messages as adapter-node 5, which README-Docker.md refers to. */
function parseOrigin(value) {
    let url;
    try {
        url = new URL(value.trim());
    } catch (error) {
        throw new Error(
            `Invalid ORIGIN: '${value}'. ORIGIN must be a valid URL with http:// or https:// protocol. For example: 'http://localhost:3000' or 'https://my.site'`,
            { cause: error }
        );
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(
            `Invalid ORIGIN: '${value}'. Only http:// and https:// protocols are supported. Received protocol: ${url.protocol}`
        );
    }
    return url;
}

const origin = process.env.ORIGIN === undefined ? null : parseOrigin(process.env.ORIGIN);

if (origin) {
    // adapter-node reads these when build/index.js loads, so they are set before the import. No
    // prefix: vite.config.ts gives adapter-node an empty envPrefix.
    process.env.PROTOCOL_HEADER = PROTOCOL_HEADER;
    process.env.HOST_HEADER = HOST_HEADER;
    delete process.env.PORT_HEADER;
}

const { server } = await import('./build/index.js');

if (origin) {
    const protocol = origin.protocol.slice(0, -1);
    // Prepended, so it runs before adapter-node's own request listener.
    server.prependListener('request', (req) => {
        req.headers[PROTOCOL_HEADER] = protocol;
        req.headers[HOST_HEADER] = origin.host;
    });
}
