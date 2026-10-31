import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// server.js starts build/index.js, which only a build writes. This one stands in for it: it
// answers the way each part of the built app does, without going through hooks.server.ts.
const stubBuild = `
import http from 'node:http';
export const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
        // A static file: adapter-node's static handler passes its headers to writeHead.
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('User-agent: *');
    } else if (req.url === '/api/bottles') {
        // SvelteKit's own CSRF answer, written by setResponse: setHeader, then writeHead.
        res.setHeader('content-type', 'text/plain');
        res.writeHead(403).end('Cross-site POST form submissions are forbidden');
    } else if (req.url === '/broken') {
        // SvelteKit's answer when handle throws.
        res.setHeader('content-type', 'text/html');
        res.writeHead(500).end('Internal Error');
    } else {
        // adapter-node's answer to a request it cannot read.
        res.statusCode = 400;
        res.end('Invalid request body');
    }
});
server.listen(0, '127.0.0.1');
`;

let folder: string;
let base: string;
let server: Server;

beforeAll(async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'cellar-server-'));
    mkdirSync(path.join(folder, 'build'));
    writeFileSync(path.join(folder, 'build', 'index.js'), stubBuild);
    copyFileSync('server.js', path.join(folder, 'server.js'));
    await import(path.join(folder, 'server.js'));
    ({ server } = await import(path.join(folder, 'build', 'index.js')));
    if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (typeof address !== 'object' || address === null) throw new Error('Not listening');
    base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(folder, { recursive: true, force: true });
});

describe('server.js', () => {
    it.each([
        ['a static file', 'GET', '/robots.txt', 200],
        ["SvelteKit's own 403", 'POST', '/api/bottles', 403],
        ['an error of handle', 'GET', '/broken', 500],
        ["adapter-node's 400", 'GET', '/unreadable', 400]
    ])('forbids every other site to frame %s', async (_, method, url, status) => {
        const response = await fetch(`${base}${url}`, { method });

        expect(response.status).toBe(status);
        expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
        expect(response.headers.get('x-frame-options')).toBe('DENY');
    });
});
