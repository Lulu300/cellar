// The rules of releases.json, the single source of each version's summary, upgrade actions and
// mandatory stops (see RELEASING.md). Shared by the release scripts and by the upgrade check of the
// app: plain JavaScript, so that Node runs it as it is and Vite bundles it.

/** @typedef {{ version: string, summary: string, mandatoryStop: boolean, actions: string[] }} Release */

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

/**
 * Parses "X.Y.Z" or "X.Y.Z-rc.N"; `base` is the final version an rc leads to.
 * @param {string} text
 */
export function parseVersion(text) {
    const match = VERSION_PATTERN.exec(text);
    if (!match) throw new Error(`Invalid version "${text}": expected X.Y.Z or X.Y.Z-rc.N.`);
    const [, major, minor, patch, rc] = match;
    return {
        text,
        base: `${major}.${minor}.${patch}`,
        isPrerelease: rc !== undefined,
        // A final version sorts after all of its release candidates.
        order: [
            Number(major),
            Number(minor),
            Number(patch),
            rc === undefined ? Infinity : Number(rc)
        ]
    };
}

/**
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
    const left = parseVersion(a).order;
    const right = parseVersion(b).order;
    const index = left.findIndex((part, i) => part !== right[i]);
    return index === -1 ? 0 : Math.sign(left[index] - right[index]);
}

/**
 * Returns the parsed content of releases.json, newest first, after checking the fields every
 * consumer relies on.
 * @param {any[]} releases
 * @returns {Release[]}
 */
export function checkReleases(releases) {
    releases.forEach((release, i) => {
        const where = `releases.json, entry ${i} (${release.version})`;
        if (parseVersion(release.version).isPrerelease)
            throw new Error(`${where}: use the final version, not an rc.`);
        if (i > 0 && compareVersions(releases[i - 1].version, release.version) <= 0) {
            throw new Error(`${where}: entries must be sorted from newest to oldest.`);
        }
        if (typeof release.summary !== 'string' || !release.summary.trim())
            throw new Error(`${where}: summary is required.`);
        if (typeof release.mandatoryStop !== 'boolean')
            throw new Error(`${where}: mandatoryStop must be true or false.`);
        if (
            !Array.isArray(release.actions) ||
            release.actions.some(
                (/** @type {unknown} */ action) => typeof action !== 'string' || !action.trim()
            )
        ) {
            throw new Error(`${where}: actions must be a list of non-empty strings.`);
        }
    });
    return releases;
}

/**
 * The entry of `version`, or of its final version for an rc.
 * @param {Release[]} releases
 * @param {string} version
 */
export function findRelease(releases, version) {
    const { base } = parseVersion(version);
    const release = releases.find((entry) => entry.version === base);
    if (!release)
        throw new Error(
            `Unknown version ${version}: releases.json has no entry for ${base}; add one first (see RELEASING.md).`
        );
    return release;
}

/**
 * What upgrading from `from` to `to` crosses: `steps`, the releases after `from` up to `to`, oldest
 * first, and `stops`, those of them that must be installed and started on the way. An rc already
 * required the actions of its final version, so both count as their final version. `from` needs
 * no entry: a build of develop may carry an rc whose entry was later renamed (see RELEASING.md).
 * @param {Release[]} releases
 * @param {string} from
 * @param {string} to
 */
export function upgradeSteps(releases, from, to) {
    const fromBase = parseVersion(from).base;
    const toBase = findRelease(releases, to).version;
    const steps = releases
        .filter(
            (release) =>
                compareVersions(release.version, fromBase) > 0 &&
                compareVersions(release.version, toBase) <= 0
        )
        .reverse();
    const stops = steps
        .filter((release) => release.mandatoryStop && release.version !== toBase)
        .map((release) => release.version);
    return { steps, stops };
}
