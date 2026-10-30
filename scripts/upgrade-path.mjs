// Prints, oldest first, the upgrade actions and mandatory stops between two versions.
// Usage: node scripts/upgrade-path.mjs <from> <to>   (e.g. 0.1.0 0.2.0)
import { compareVersions, upgradeSteps } from '#lib/server/releases.js';
import { loadReleases, renderUpgradeActions, requiresAction } from './release-data.mjs';

/**
 * @param {string} from
 * @param {string} to
 */
function upgradePath(from, to) {
    if (compareVersions(from, to) >= 0) throw new Error(`${from} is not older than ${to}.`);
    const { steps, stops } = upgradeSteps(loadReleases(), from, to);

    const lines = [`Upgrading from ${from} to ${to}.`, ''];
    const withActions = steps.filter(requiresAction);
    if (withActions.length === 0) lines.push('No upgrade action.', '');
    for (const release of withActions)
        lines.push(`${release.version}:`, renderUpgradeActions(release), '');
    lines.push(
        stops.length
            ? `Mandatory stops: install and start ${stops.join(', then ')}, then ${to}.`
            : `No mandatory stop: you can install ${to} directly.`
    );
    return lines.join('\n');
}

const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error('Usage: node scripts/upgrade-path.mjs <from> <to>');
    process.exit(1);
}
try {
    console.log(upgradePath(args[0], args[1]));
} catch (error) {
    console.error(/** @type {Error} */ (error).message);
    process.exit(1);
}
