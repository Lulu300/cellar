import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import { loadConfig } from '@sveltejs/load-config';

// The Svelte options live in the sveltekit() plugin of vite.config.ts.
const loaded = await loadConfig(fileURLToPath(new URL('./vite.config.ts', import.meta.url)));
if (!loaded || 'error' in loaded) {
    throw new Error('Cannot read the Svelte options from vite.config.ts', { cause: loaded?.error });
}
const svelteConfig = loaded.config;

const ignoreFile = (name) => includeIgnoreFile(fileURLToPath(new URL(name, import.meta.url)));

export default defineConfig(
    ignoreFile('./.gitignore'),
    // Shared with Prettier, so both tools skip the same files.
    ignoreFile('./.prettierignore'),
    js.configs.recommended,
    ...ts.configs.recommended,
    ...svelte.configs.recommended,
    prettier,
    ...svelte.configs.prettier,
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node }
        },
        rules: {
            // typescript-eslint recommends turning no-undef off: TypeScript already reports undefined names.
            // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-i-have-lint-rules-that-enable-them
            'no-undef': 'off',

            // The browser code reports to the user, not to a console nobody reads.
            'no-console': 'error',

            // Cellar is served at the root, so plain paths are already correct.
            'svelte/no-navigation-without-resolve': 'off'
        }
    },
    {
        // Routes go through the services of src/lib/server/features: only they reach the
        // database. Types stay importable, such as the row types that pages show.
        files: ['src/routes/**'],
        ignores: ['**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            // `#` starts a comment in these gitignore-style patterns.
                            group: [
                                '\\#lib/server/db/*',
                                '$lib/server/db/*',
                                '**/lib/server/db/*',
                                'drizzle-orm',
                                'drizzle-orm/*',
                                'better-sqlite3'
                            ],
                            allowTypeImports: true,
                            message:
                                'Routes reach the database through a service of src/lib/server/features.'
                        },
                        {
                            group: [
                                '\\#lib/server/features/*/repository*',
                                '**/features/*/repository*'
                            ],
                            message: 'Routes call the service of a feature, not its repository.'
                        }
                    ]
                }
            ]
        }
    },
    {
        // The server logs to the container's output, and command-line scripts report through the
        // console (log convention in AGENTS.md).
        files: [
            'src/lib/server/**',
            'src/**/*.server.ts',
            'src/routes/**/+server.ts',
            'scripts/**'
        ],
        rules: { 'no-console': 'off' }
    },
    {
        // The shadcn-svelte primitives stay as the CLI writes them (decision UI-01): this one
        // declares `ref = $bindable(null)` and never reads it.
        files: ['src/lib/components/ui/select/select-group.svelte'],
        rules: { 'no-useless-assignment': 'off' }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: ts.parser,
                svelteConfig
            }
        }
    }
);
