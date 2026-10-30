import { defineConfig, devices } from '@playwright/test';

const port = 4421;
const origin = `http://localhost:${port}`;

export default defineConfig({
    testDir: 'e2e',
    // The journeys share one server and one database, and one of them wipes the cellar.
    workers: 1,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: origin,
        locale: 'en-US',
        trace: 'retain-on-failure'
    },
    // The journeys follow the menu, whose links show from 1280 px wide: Desktop Chrome's width.
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node e2e/server.mjs',
        url: `${origin}/robots.txt`,
        // Never a server that is already running: it could be serving real data.
        reuseExistingServer: false,
        env: { ORIGIN: origin, PORT: String(port), HOST: '127.0.0.1' },
        // A fresh install logs the token that choosing the first access code takes; Playwright
        // passes it to the tests as process.env.SETUP_TOKEN.
        wait: { stdout: /Setup token to choose the first access code: (?<setup_token>[A-Z0-9-]+)/ },
        stdout: 'pipe',
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 }
    }
});
