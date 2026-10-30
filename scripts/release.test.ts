import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { scratchFolder } from '../src/test/scratch.js';

// `release.mjs check` runs in a new git repository that holds the release scripts and a
// releases.json of its own: v0.1.0 is tagged, and 0.2.0 is on its way.
const FILES = ['scripts/release.mjs', 'scripts/release-data.mjs', 'src/lib/server/releases.js'];
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Commits that neither the developer's git settings (signing, hooks) nor the CI can change. A test
// run from a git hook inherits GIT_DIR and the like, which would send git to the real repository.
const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com'
};

let repo: string;

const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env, stdio: 'pipe' });

function release(...args: string[]) {
    const result = spawnSync(process.execPath, ['scripts/release.mjs', ...args], {
        cwd: repo,
        env,
        encoding: 'utf8'
    });
    return { passed: result.status === 0, output: result.stdout + result.stderr };
}

function writeReleases(actionsOf020: string[] = []) {
    const entry = (version: string, actions: string[] = []) => ({
        version,
        summary: `Changes of ${version}.`,
        mandatoryStop: false,
        actions
    });
    writeFileSync(
        path.join(repo, 'releases.json'),
        JSON.stringify([entry('0.2.0', actionsOf020), entry('0.1.0')])
    );
}

/** Commits everything, as `message` and an optional footer. */
function commit(message: string, footer?: string) {
    git('add', '-A');
    git('commit', '--allow-empty', '-m', message, ...(footer ? ['-m', footer] : []));
}

/** Prepares `version`, commits it and puts it on `branch` of origin, as a pushed release. */
function prepareOn(version: string, branch: 'develop' | 'main') {
    expect(release('prepare', version).passed).toBe(true);
    commit(`chore(release): ${version}`);
    git('update-ref', `refs/remotes/origin/${branch}`, 'HEAD');
}

beforeEach(() => {
    repo = scratchFolder('release-');
    for (const file of [...FILES, 'cliff.toml']) {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        cpSync(path.join(ROOT, file), path.join(repo, file));
    }
    // git-cliff, which writes the changes of each version.
    symlinkSync(path.join(ROOT, 'node_modules'), path.join(repo, 'node_modules'));
    writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');
    writeFileSync(
        path.join(repo, 'package.json'),
        JSON.stringify(
            { type: 'module', version: '0.0.0', imports: { '#lib/*': './src/lib/*' } },
            null,
            4
        )
    );
    git('init', '--quiet', '--initial-branch', 'develop');
    writeReleases();
    prepareOn('0.1.0', 'main');
    git('tag', 'v0.1.0');
    commit('feat: a feature of 0.2.0');
});

// Each test runs node, git and git-cliff a dozen times.
describe('release.mjs check', { timeout: 20_000 }, () => {
    it('passes a release candidate on origin/develop, with its version and generated files', () => {
        prepareOn('0.2.0-rc.0', 'develop');

        expect(release('check', 'v0.2.0-rc.0')).toEqual({
            passed: true,
            output: 'v0.2.0-rc.0 can be released.\n'
        });
    });

    it('refuses a tag that is not v followed by a version', () => {
        prepareOn('0.2.0-rc.0', 'develop');

        const { passed, output } = release('check', '0.2.0-rc.0');
        expect(passed).toBe(false);
        expect(output).toContain('Invalid tag "0.2.0-rc.0"');
    });

    it('refuses a tag whose version is not the one of package.json', () => {
        prepareOn('0.2.0-rc.0', 'develop');

        const { passed, output } = release('check', 'v0.2.0-rc.1');
        expect(passed).toBe(false);
        expect(output).toContain('package.json has version 0.2.0-rc.0, not 0.2.0-rc.1.');
    });

    it('refuses a release candidate that is not on origin/develop', () => {
        prepareOn('0.2.0-rc.0', 'develop');
        git('update-ref', 'refs/remotes/origin/develop', 'v0.1.0');

        const { passed, output } = release('check', 'v0.2.0-rc.0');
        expect(passed).toBe(false);
        expect(output).toContain('v0.2.0-rc.0 must be on develop');
    });

    it('takes a final version from origin/main only', () => {
        prepareOn('0.2.0', 'develop');

        const { passed, output } = release('check', 'v0.2.0');
        expect(passed).toBe(false);
        expect(output).toContain('v0.2.0 must be on main');

        git('update-ref', 'refs/remotes/origin/main', 'HEAD');
        expect(release('check', 'v0.2.0').passed).toBe(true);
    });

    it('asks for the tag of the previous version when it is missing', () => {
        prepareOn('0.2.0-rc.0', 'develop');
        git('tag', '--delete', 'v0.1.0');

        const { passed, output } = release('check', 'v0.2.0-rc.0');
        expect(passed).toBe(false);
        expect(output).toContain('Tag v0.1.0 not found');
    });

    it('refuses a generated file that the release did not regenerate', () => {
        prepareOn('0.2.0-rc.0', 'develop');
        writeFileSync(path.join(repo, 'UPGRADING.md'), '# Upgrading\n');
        commit('docs: edit UPGRADING.md by hand');
        git('update-ref', 'refs/remotes/origin/develop', 'HEAD');

        const { passed, output } = release('check', 'v0.2.0-rc.0');
        expect(passed).toBe(false);
        expect(output).toContain(
            'UPGRADING.md is out of date: run "node scripts/release.mjs prepare 0.2.0-rc.0"'
        );
    });

    describe('with a breaking commit since the previous version', () => {
        it.each([
            ['a "!" after the type', 'feat!: drop the old API', undefined],
            ['a "!" after the scope', 'refactor(api)!: rename a field', undefined],
            ['a BREAKING CHANGE footer', 'feat: move the data', 'BREAKING CHANGE: move it by hand'],
            ['a BREAKING-CHANGE footer', 'fix: rename a variable', 'BREAKING-CHANGE: rename it']
        ])(
            'refuses one marked by %s when the version has no upgrade action',
            (_, message, footer) => {
                commit(message, footer);
                prepareOn('0.2.0-rc.0', 'develop');

                const { passed, output } = release('check', 'v0.2.0-rc.0');
                expect(passed).toBe(false);
                expect(output).toContain(
                    `Breaking commits but no upgrade action for 0.2.0 in releases.json:\n  `
                );
                expect(output).toContain(message);
            }
        );

        it('passes once the version has an upgrade action', () => {
            commit('feat!: drop the old API');
            writeReleases(['Update the scripts that call the old API.']);
            prepareOn('0.2.0-rc.0', 'develop');

            expect(release('check', 'v0.2.0-rc.0').passed).toBe(true);
        });

        it('ignores a commit that only mentions a breaking change in its text', () => {
            commit('fix: say why nothing breaks', 'No BREAKING CHANGE: the field keeps its name.');
            prepareOn('0.2.0-rc.0', 'develop');

            expect(release('check', 'v0.2.0-rc.0').passed).toBe(true);
        });
    });
});
