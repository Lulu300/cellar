// Checks that the built app (`pnpm build` first) applies ORIGIN through server.js: a write from
// ORIGIN passes the CSRF checks (401: no session), a write from any other origin gets 403, even
// with forged origin headers. Without server.js, adapter-node ignores ORIGIN and refuses both.
// Also checks that / answers 200, as the healthcheck of the Docker image expects, and that a page
// and a static file carry the headers that forbid framing, which server.js sets.
//
// Runs the app on data in a temporary folder, so that it never opens the developer's database.
// Usage: node scripts/check-origin.mjs [port]
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { throwawayDataPaths } from './throwaway-data.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ?? '3999';
const origin = `http://localhost:${port}`;

async function answers() {
    try {
        await fetch(`${origin}/robots.txt`);
        return true;
    } catch {
        return false;
    }
}

// Otherwise the requests could reach whatever already listens there.
if (await answers()) throw new Error(`Port ${port} is already in use`);

// The app finds its migrations in ./drizzle, relative to the working directory.
const cwd = mkdtempSync(path.join(tmpdir(), 'cellar-origin-'));
symlinkSync(path.join(root, 'drizzle'), path.join(cwd, 'drizzle'));

const server = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd,
    env: {
        ...process.env,
        ...throwawayDataPaths(cwd),
        ORIGIN: origin,
        PORT: port,
        HOST: '127.0.0.1'
    },
    stdio: ['ignore', 'ignore', 'inherit']
});
const exited = once(server, 'exit');
const running = () => server.exitCode === null && server.signalCode === null;

async function waitForServer() {
    for (let attempt = 0; attempt < 60; attempt++) {
        if (!running()) throw new Error(`The app exited with code ${server.exitCode}`);
        if (await answers()) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`The app did not answer on ${origin}`);
}

const cases = [
    { name: 'JSON write from ORIGIN', from: origin, json: true, expected: 401 },
    { name: 'form write from ORIGIN', from: origin, json: false, expected: 401 },
    {
        name: 'JSON write from another origin',
        from: 'http://evil.example',
        json: true,
        expected: 403
    },
    {
        name: 'form write from another origin',
        from: 'http://evil.example',
        json: false,
        expected: 403
    },
    {
        name: 'form write from another origin, forged origin headers',
        from: 'http://evil.example',
        json: false,
        headers: {
            'x-cellar-origin-protocol': 'http',
            'x-cellar-origin-host': 'evil.example',
            'x-forwarded-proto': 'http',
            'x-forwarded-host': 'evil.example'
        },
        expected: 403
    }
];

let failures = 0;
/**
 * @param {string} name
 * @param {number | string | null} actual A status or a header value
 * @param {number | string} expected
 */
function report(name, actual, expected) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${actual} (expected ${expected})`);
}

try {
    await waitForServer();
    // Not followed: a redirect would make the container unhealthy.
    const home = await fetch(`${origin}/`, { redirect: 'manual' });
    report('GET /', home.status, 200);
    for (const response of [home, await fetch(`${origin}/robots.txt`)]) {
        const { pathname } = new URL(response.url);
        report(
            `frame-ancestors on ${pathname}`,
            response.headers.get('content-security-policy'),
            "frame-ancestors 'none'"
        );
        report(`X-Frame-Options on ${pathname}`, response.headers.get('x-frame-options'), 'DENY');
    }
    for (const { name, from, json, headers, expected } of cases) {
        const response = await fetch(`${origin}/api/bottles`, {
            method: 'POST',
            headers: {
                Origin: from,
                ...(json && { 'Content-Type': 'application/json' }),
                ...headers
            },
            body: json ? JSON.stringify({}) : new URLSearchParams({ x: '1' })
        });
        report(name, response.status, expected);
    }
} finally {
    if (running()) {
        server.kill();
        await exited;
    }
    rmSync(cwd, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
