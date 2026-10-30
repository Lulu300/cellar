import type { UpgradeNotice } from '#lib/server/upgrade.js';

export type UpgradeAction = UpgradeNotice['actions'][number];

/** An action's key: its version, and its place in that version's list. */
export const actionKey = (action: UpgradeAction) => `${action.version}#${action.index}`;

/**
 * The actions shown so far, then those of `latest` not among them. The server leaves a ticked
 * action out of the list it sends, which the admin reads again after each save (invalidateAll):
 * kept, it stays shown until the next visit, so that a wrong tick can be undone.
 */
export function keepShown(shown: UpgradeAction[], latest: UpgradeAction[]): UpgradeAction[] {
    const keys = new Set(shown.map(actionKey));
    return [...shown, ...latest.filter((action) => !keys.has(actionKey(action)))];
}
