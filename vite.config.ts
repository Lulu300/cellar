/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-node';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import type { Adapter } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import pkg from './package.json' with { type: 'json' };

// The scanner serves zxing-wasm's .wasm itself (src/lib/utils/barcode-scanner.ts). It must be the
// copy that barcode-detector depends on, which only barcode-detector can resolve.
const zxingReaderWasm = createRequire(
    createRequire(import.meta.url).resolve('barcode-detector')
).resolve('zxing-wasm/reader/zxing_reader.wasm');

/**
 * adapter-node without the uploaded images. By default they live in static/uploads, which the
 * build copies into build/ like any static file: a build outside Docker would ship them, and serve
 * those copies, frozen at build time, instead of the uploads route. (.dockerignore keeps them out of
 * the image build.) SvelteKit's own manifest still lists them, which only matters to a server-side
 * fetch of /uploads/ in a load function: there is none.
 * Relies on adapter-node 6 building the table of the static files it serves from the list that
 * builder.writeClient returns, which vite.config.test.ts checks. `out`: for that test.
 */
export function adapterWithoutUploads(out = 'build'): Adapter {
    const nodeAdapter = adapter({ out, precompress: false, envPrefix: '' });
    return {
        ...nodeAdapter,
        adapt(builder) {
            const writeClient = builder.writeClient.bind(builder);
            builder.writeClient = (dest) => {
                const files = writeClient(dest);
                rmSync(`${dest}/uploads`, { recursive: true, force: true });
                return files.filter((file) => !file.startsWith('uploads/'));
            };
            return nodeAdapter.adapt(builder);
        }
    };
}

export default defineConfig({
    plugins: [
        tailwindcss(),
        // Compiles the messages into src/lib/paraglide (options in project.inlang/paraglide.config.js)
        paraglideVitePlugin({ project: './project.inlang' }),
        sveltekit({
            preprocess: vitePreprocess(),
            adapter: adapterWithoutUploads()
            // No `paths.origin`: it is fixed at build time, and one Docker image serves every URL.
            // server.js turns the ORIGIN variable into the request origin at startup instead.
            // SvelteKit's CSRF check (always on) compares the browser Origin with that origin for
            // POST, PUT, PATCH and DELETE with a form content type or none; src/lib/server/csrf.ts
            // extends it to every write.
        })
    ],
    // Inlined at build time, so the running app never reads package.json.
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
        // A pattern, so that the import keeps its ?url suffix
        alias: [{ find: /^zxing-wasm\/reader\/zxing_reader\.wasm/, replacement: zxingReaderWasm }]
    },
    test: {
        include: [
            'src/**/*.test.ts',
            'scripts/**/*.test.ts',
            'vite.config.test.ts',
            'server.test.ts'
        ],
        setupFiles: ['src/test/setup.ts'],
        // The server code logs a lot; show it only for the tests that fail.
        silent: 'passed-only'
    }
});
