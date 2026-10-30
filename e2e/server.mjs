// Starts the built app (`pnpm build` first) for the end-to-end tests, on a new empty data folder:
// they need a fresh install, and must never open the developer's data/.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { throwawayDataPaths } from '../scripts/throwaway-data.mjs';

const dataRoot = mkdtempSync(path.join(tmpdir(), 'cellar-e2e-'));
Object.assign(process.env, throwawayDataPaths(dataRoot));

// Removed on any exit, a failed start included. Playwright stops the server with SIGTERM
// (gracefulShutdown in playwright.config.ts), and Ctrl+C on a manual run sends SIGINT: both exit
// through here.
process.on('exit', () => rmSync(dataRoot, { recursive: true, force: true }));
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

await import('../server.js');
