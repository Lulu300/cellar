import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// server.js starts build/index.js, which only a build writes. This one stands in for it: it
// answers the way each part of the built app does, without going through hooks.server.ts.
const stubBuild = `
import http from 'node:http';
// Node's default of 5 minutes for a request to arrive, made 1 second, checked every 100 ms.
const options = { requestTimeout: 1000, connectionsCheckingInterval: 100 };
export const server = http.createServer(options, (req, res) => {
    if (req.url === '/api/admin/restore') {
        // A route that reads the whole body before it answers.
        req.resume();
        req.on('end', () => res.writeHead(200).end());
    } else if (req.url === '/robots.txt') {
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

    it("gives an upload longer than Node's default to arrive", async () => {
        const { port } = new URL(base);
        const body = 'slow!';
        // Sends one byte every 500 ms: the body takes 2.5 s, past the stub's 1 s.
        const statusLine = await new Promise<string>((resolve, reject) => {
            const socket = connect(Number(port), '127.0.0.1');
            let sent = 0;
            const timer = setInterval(() => {
                socket.write(body[sent++]);
                if (sent === body.length) clearInterval(timer);
            }, 500);
            let answer = '';
            socket.on('data', (chunk) => (answer += chunk));
            socket.on('close', () => {
                clearInterval(timer);
                resolve(answer.split('\r\n')[0]);
            });
            socket.on('error', reject);
            socket.write(
                `POST /api/admin/restore HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`
            );
        });

        expect(statusLine).toBe('HTTP/1.1 200 OK');
    });
});
