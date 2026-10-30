// Reads releases.json for the release scripts. The rules shared with the app's upgrade check live
// in src/lib/server/releases.js; the release notes, CHANGELOG.md, UPGRADING.md and upgrade-path.mjs
// are all derived from releases.json.
import { readFileSync } from 'node:fs';
import { checkReleases } from '#lib/server/releases.js';

/** Returns the releases, newest first, after checking the fields every consumer relies on. */
export function loadReleases() {
    return checkReleases(
        JSON.parse(readFileSync(new URL('../releases.json', import.meta.url), 'utf8'))
    );
}

/** @typedef {import('#lib/server/releases.js').Release} Release */

/**
 * Whether upgrading to this version asks anything of the user.
 * @param {Release} release
 */
export const requiresAction = (release) => release.mandatoryStop || release.actions.length > 0;

/**
 * Markdown list of a version's upgrade actions, shared by the notes, UPGRADING.md and upgrade-path.mjs.
 * @param {Release} release
 */
export function renderUpgradeActions(release) {
    const lines = release.actions.map((action) => `- ${action}`);
    if (release.mandatoryStop) {
        lines.unshift(
            `- **Mandatory stop:** install and start ${release.version} once before upgrading to a later version.`
        );
    }
    return lines.length ? lines.join('\n') : 'None.';
}
