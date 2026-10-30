import type { KnipConfig } from 'knip';

const scriptBlock = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const importStatement =
    /^\s*import\b([^;'"]*?)\bfrom\s*['"][^'"]+['"]|^\s*import\s*['"][^'"]+['"]/gm;
const dynamicImport = /\bimport\s*\(\s*['"][^'"]+['"]\s*\)/g;

/**
 * Knip's own Svelte compiler keeps only the imports, so it cannot see a member of an import used
 * in the component (`<Select.Item>`, `adminStores.uiActions`, `WineType.VIN`) and reports it
 * unused. This one passes on the static and dynamic imports, and every `Import.member` reference.
 */
function svelte(text: string): string {
    const scripts = [...text.matchAll(scriptBlock)].map(([, body]) => body).join('\n');
    const imports = [...scripts.matchAll(importStatement)];
    const names = imports
        .flatMap(([, bindings]) => bindings?.match(/\w+/g) ?? [])
        .filter((name) => name !== 'type' && name !== 'as');
    const references = names.length
        ? (text.match(new RegExp(`\\b(?:${names.join('|')})\\.\\w+`, 'g')) ?? [])
        : [];
    return [
        ...imports.map(([statement]) => statement),
        ...(text.match(dynamicImport) ?? []),
        ...references
    ].join(';\n');
}

const config: KnipConfig = {
    // Run by hand (RELEASING.md, AGENTS.md); read by Paraglide JS
    entry: [
        'scripts/*.mjs',
        'docs/roadmap/build.mjs',
        'docs/roadmap/status.mjs',
        'project.inlang/paraglide.config.js'
    ],
    // The cases of scripts/check-i18n.test.ts, which the script reads as files
    ignore: ['scripts/check-i18n-cases/**'],
    ignoreDependencies: [
        // An alias in vite.config.ts resolves it to barcode-detector's own copy
        'zxing-wasm',
        // Loaded by its path, from project.inlang/settings.json
        '@inlang/plugin-icu1'
    ],
    // The shadcn-svelte primitives (components.json) stay as their CLI writes them, with every
    // part exported under two names, used or not
    ignoreIssues: { 'src/lib/components/ui/*/index.ts': ['exports', 'types'] },
    compilers: { svelte }
};

export default config;
