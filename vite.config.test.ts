import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Builder } from '@sveltejs/kit';
import { afterEach, describe, expect, it } from 'vitest';
import { adapterWithoutUploads } from './vite.config';

const folders: string[] = [];
afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/**
 * The part of SvelteKit's builder that adapter-node 6 calls, for a build whose static folder holds
 * `files`. Should adapter-node call more of it, the test fails: check then that the build still
 * leaves the uploads out.
 */
function builderWithStaticFiles(root: string, files: string[]): Builder {
    const serverDir = path.join(root, 'server-output');
    mkdirSync(serverDir);
    return {
        config: { paths: { base: '', origin: '' } },
        log: { minor: () => {} },
        prerendered: { paths: [] },
        mimeTypes: {},
        writeClient(dest: string) {
            for (const file of files) {
                mkdirSync(path.dirname(path.join(dest, file)), { recursive: true });
                writeFileSync(path.join(dest, file), file);
            }
            return files;
        },
        writePrerendered: () => [],
        getServerDirectory: () => serverDir,
        generateServerInstance: () => {},
        hasServerInstrumentationFile: () => false,
        copy(from: string, to: string) {
            cpSync(from, to, { recursive: true });
            return [];
        },
        getAppPath: () => '_app'
    } as unknown as Builder;
}

describe('adapterWithoutUploads', () => {
    // static/uploads holds the uploaded images when the app runs outside Docker.
    it('leaves static/uploads out of the build and of the files it serves', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'cellar-adapter-'));
        folders.push(root);
        const out = path.join(root, 'build');
        const builder = builderWithStaticFiles(root, ['robots.txt', 'uploads/wines/wine-a.jpg']);

        await adapterWithoutUploads(out).adapt(builder);

        expect(existsSync(path.join(out, 'client', 'robots.txt'))).toBe(true);
        expect(existsSync(path.join(out, 'client', 'uploads'))).toBe(false);
        const servedFiles = readFileSync(path.join(out, 'adapter-node.js'), 'utf8');
        expect(servedFiles).toContain('robots.txt');
        expect(servedFiles).not.toContain('uploads/');
    });
});
