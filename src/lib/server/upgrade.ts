import { dev } from '$app/env';
import { db } from '#lib/server/db/index.js';
import { lastAppliedMigration, openDatabase, type Db, type Tx } from '#lib/server/db/connection.js';
import {
    getAppSetting,
    putBackAppSetting,
    setAppSetting
} from '#lib/server/features/settings/repository.js';
import { InvalidBackupError } from '#lib/server/features/backup/restore.js';
import {
    checkReleases,
    compareVersions,
    parseVersion,
    upgradeSteps,
    type Release
} from '#lib/server/releases.js';
// Bundled into the build: the running app never reads the file.
import releasesJson from '../../../releases.json';

const RELEASES = checkReleases(releasesJson);

/** The version that last started successfully on this database. */
export const APP_VERSION_KEY = 'app_version';
/** JSON list of PendingAction: the upgrade actions shown in the admin. */
export const UPGRADE_ACTIONS_KEY = 'upgrade_actions';

const ORIGIN_DOC =
    'https://github.com/Lulu300/cellar/blob/main/README-Docker.md#application-url-origin';

/**
 * The versions that ran before this check existed did not record themselves, so a database from
 * one of them only tells its migrations: the newest one each version shipped, by its `when` in the
 * Drizzle journal of those versions. Versions that shipped the same migrations form a range. A
 * release candidate of the second entry's `lowest` still ended at 0002, like the first entry, but
 * its database is taken for the first entry on purpose: most actions of that `lowest` were added
 * after the candidate and apply to it too, while marking them "may already be done" would weaken
 * them for every user of the first entry. Never extended: later versions record themselves.
 */
export const UNRECORDED_VERSIONS = [
    { lastMigration: 1766167130064, lowest: '0.1.0', highest: '0.1.0' }, // 0002_fine_nextwave
    { lastMigration: 1791553557502, lowest: '0.2.0', highest: '0.3.0' }, // 0003_modern_caretaker
    { lastMigration: 1791719207262, lowest: '0.4.0', highest: '0.5.0' } // 0004_remove_csv_header_appellation
];

/** What the database tells of the version that last started on it, read before the migrations. */
export type PreviousStart =
    | { kind: 'fresh' }
    | { kind: 'recorded'; version: string }
    | { kind: 'unrecorded'; lastMigration: number };

/** An action of releases.json, by its version and its position there, as stored in the settings. */
export type PendingAction = { version: string; index: number; mayBeDone: boolean; done: boolean };

export type UpgradePlan = {
    /** The version that starts. */
    current: string;
    /** The version that last started, or the range it lies in when it did not record itself. */
    from: { lowest: string; highest: string; recorded: boolean } | null;
    upgraded: boolean;
    /** The actions of the versions this start upgrades through, oldest first. */
    actions: PendingAction[];
};

/** Why this version must not take a database, for the UI to say it in its language. */
export type Refusal =
    | { kind: 'newer'; backupVersion: string; currentVersion: string }
    | {
          kind: 'mandatory_stop';
          backupVersion: string;
          /** The database records no version: it may come from an older one too. */
          orOlder: boolean;
          stopVersion: string;
          currentVersion: string;
      };

/**
 * This version must not take this database. The message says what to do instead at a start, and
 * `restoreAdvice` when the database is a backup being restored.
 */
export class UpgradeRefusal extends Error {
    constructor(
        message: string,
        readonly restoreAdvice: string,
        readonly refusal: Refusal
    ) {
        super(message);
    }
}

export function readPreviousStart(database: Db = db): PreviousStart {
    const sqlite = database.$client;
    const lastMigration = lastAppliedMigration(sqlite);
    if (lastMigration === null) return { kind: 'fresh' };
    // Raw SQL: read before the migrations, so the table may lack columns that the schema of this
    // version declares.
    const version = sqlite
        .prepare('SELECT value FROM app_settings WHERE key = ?')
        .pluck()
        .get(APP_VERSION_KEY) as string | undefined;
    return version ? { kind: 'recorded', version } : { kind: 'unrecorded', lastMigration };
}

function unrecordedRange(lastMigration: number) {
    const newest = UNRECORDED_VERSIONS.findLast((entry) => entry.lastMigration <= lastMigration);
    // Older still: a database from before the first tagged version.
    const { lowest, highest } = newest ?? UNRECORDED_VERSIONS[0];
    return { lowest, highest };
}

const base = (version: string) => parseVersion(version).base;

/**
 * What starting `current` on a database last used as `previous` involves. Throws UpgradeRefusal
 * when the database comes from a newer version, an rc older than the final version included, or
 * when the upgrade skips a mandatory stop. For the actions and the stops, an rc counts as its
 * final version.
 */
export function planUpgrade(
    releases: Release[],
    current: string,
    previous: PreviousStart
): UpgradePlan {
    if (previous.kind === 'fresh') return { current, from: null, upgraded: false, actions: [] };
    const from =
        previous.kind === 'recorded'
            ? { lowest: previous.version, highest: previous.version, recorded: true }
            : { ...unrecordedRange(previous.lastMigration), recorded: false };

    // Exact versions: an older rc may lack a migration of the version that used the database.
    if (compareVersions(from.lowest, current) > 0) {
        throw new UpgradeRefusal(
            `this database comes from ${from.lowest}, newer than this ${current}: start ${from.lowest} again, or restore a backup made before the upgrade.`,
            `This backup comes from ${from.lowest}, newer than this ${current}: restore it with ${from.lowest} or later.`,
            { kind: 'newer', backupVersion: from.lowest, currentVersion: current }
        );
    }
    // From the highest version it may come from: a stop it may have passed is not held against it.
    const { stops } = upgradeSteps(releases, from.highest, current);
    if (stops.length > 0) {
        const last = from.recorded ? from.highest : `${from.highest} or an older version`;
        throw new UpgradeRefusal(
            `this database was last used by ${last}, and upgrading to ${current} skips the mandatory stop ${stops.join(', then ')}. Install ${stops[0]} first and start it once, then install ${current} again.`,
            `This backup comes from ${last}, before the mandatory stop ${stops.join(', then ')}: restore it with ${stops[0]}, then restart that version once, back it up again, and restore that new backup here.`,
            {
                kind: 'mandatory_stop',
                backupVersion: from.highest,
                orOlder: !from.recorded,
                stopVersion: stops[0],
                currentVersion: current
            }
        );
    }
    const { steps } = upgradeSteps(releases, from.lowest, current);
    return {
        current,
        from,
        upgraded: compareVersions(base(from.lowest), base(current)) < 0,
        actions: steps.flatMap((release) =>
            release.actions.map((_, index) => ({
                version: release.version,
                index,
                // Within the range of an unrecorded version, the user may have taken it already.
                mayBeDone: compareVersions(release.version, base(from.highest)) <= 0,
                done: false
            }))
        )
    };
}

function isPendingAction(value: unknown): value is PendingAction {
    const action = value as PendingAction;
    return (
        typeof action?.version === 'string' &&
        Number.isInteger(action.index) &&
        typeof action.mayBeDone === 'boolean' &&
        typeof action.done === 'boolean'
    );
}

/** A stored list, without what it should not hold: a damaged value must not stop a start. */
function parsePendingActions(value: string | undefined): PendingAction[] {
    try {
        const stored = JSON.parse(value ?? '[]');
        return Array.isArray(stored) ? stored.filter(isPendingAction) : [];
    } catch {
        return [];
    }
}

const readPendingActions = () => parsePendingActions(getAppSetting(UPGRADE_ACTIONS_KEY)?.value);

/** Those still to do from earlier upgrades, then the new ones. */
function mergeActions(stored: PendingAction[], added: PendingAction[]): PendingAction[] {
    const remaining = stored.filter((action) => !action.done);
    return [...remaining, ...unlisted(added, remaining)];
}

/** The actions of `added` that `listed` does not hold. */
function unlisted(added: PendingAction[], listed: PendingAction[]): PendingAction[] {
    return added.filter(
        (action) =>
            !listed.some(
                (entry) => entry.version === action.version && entry.index === action.index
            )
    );
}

/** The actions with their text, leaving out any that releases.json no longer has. */
function withText(actions: PendingAction[]) {
    return actions.flatMap((action) => {
        const text = RELEASES.find((release) => release.version === action.version)?.actions[
            action.index
        ];
        return text ? [{ ...action, text }] : [];
    });
}

/**
 * Reads what the last start left in the database, before the migrations: a database that this
 * version refuses must be left as it is. Throws UpgradeRefusal.
 */
export function checkUpgrade(): UpgradePlan {
    return planUpgrade(RELEASES, __APP_VERSION__, readPreviousStart());
}

/**
 * Throws UpgradeRefusal when this version must not take the database file of a backup: one from a
 * newer version, or from before a mandatory stop that it passed. Before the copy is migrated, as
 * a start checks before its migrations. Throws InvalidBackupError when its migrations or its
 * recorded version cannot be read. Returns the actions of the versions between the backup's and
 * this one, which may concern its data, such as labels to print again: all of them "may already be
 * done", since the user may have taken them on another installation.
 */
export function checkRestoredDatabase(file: string): PendingAction[] {
    const database = openDatabase(file);
    try {
        const previous = readPreviousStart(database);
        // validateBackupDatabase found the tables of a cellar: its migrations would fail on them.
        if (previous.kind === 'fresh') {
            throw new InvalidBackupError(
                'no_migrations',
                'It has the tables of a cellar but no record of its migrations.'
            );
        }
        try {
            const { actions } = planUpgrade(RELEASES, __APP_VERSION__, previous);
            return actions.map((action) => ({ ...action, mayBeDone: true }));
        } catch (error) {
            if (error instanceof UpgradeRefusal || previous.kind !== 'recorded') throw error;
            // A version that cannot be read: the backup, not the server, is at fault.
            throw new InvalidBackupError(
                'unknown_version',
                `Its recorded version "${previous.version}" is not a Cellar release.`,
                { cause: error, values: { version: previous.version } }
            );
        }
    } finally {
        database.$client.close();
    }
}

/** The stored upgrade actions of this instance, for putBackUpgradeState. */
export function getUpgradeActionsSetting(): string | undefined {
    return getAppSetting(UPGRADE_ACTIONS_KEY)?.value;
}

/**
 * In the migrated copy of a restore: this version, which migrated it, so that the next start sees
 * no upgrade; and the actions of the instance, stored as `actions`, followed by those of the
 * backup's version that the instance does not list, `backupActions` from checkRestoredDatabase.
 */
export function putBackUpgradeState(
    staged: Tx,
    actions: string | undefined,
    backupActions: PendingAction[]
): void {
    setAppSetting(APP_VERSION_KEY, __APP_VERSION__, staged);
    const kept = parsePendingActions(actions);
    // Ticked ones included: an action listed twice could not be ticked.
    const added = unlisted(backupActions, kept);
    putBackAppSetting(
        UPGRADE_ACTIONS_KEY,
        added.length > 0 ? JSON.stringify([...kept, ...added]) : actions,
        staged
    );
}

function describeFrom({ lowest, highest, recorded }: NonNullable<UpgradePlan['from']>): string {
    if (recorded) return lowest;
    const version = lowest === highest ? lowest : `a version between ${lowest} and ${highest}`;
    return `${version} (judged from the database migrations, as that version did not record itself)`;
}

/** After the migrations: records this start and the actions left to the user, and logs them. */
export function recordStartup(plan: UpgradePlan): void {
    const { current } = plan;
    const pending = mergeActions(readPendingActions(), plan.actions);
    setAppSetting(UPGRADE_ACTIONS_KEY, JSON.stringify(pending));
    setAppSetting(APP_VERSION_KEY, current);

    if (!plan.from) console.log(`🆕 Cellar ${current} starts on a new database.`);
    else if (plan.upgraded)
        console.log(`⬆️ Cellar upgraded from ${describeFrom(plan.from)} to ${current}.`);
    else if (plan.from.recorded && plan.from.lowest !== current)
        console.log(
            `✅ Cellar ${current}: the last start was ${plan.from.lowest}, which counts as the same version.`
        );
    else console.log(`✅ Cellar ${current}: same version as the last start.`);

    // As the admin shows them.
    const shown = withText(pending);
    if (shown.length === 0) return;
    if (!plan.upgraded) {
        console.log(`📋 ${shown.length} upgrade action(s) still to take: see Admin.`);
        return;
    }
    console.log('📋 Upgrade actions to take, also listed in Admin, where you can tick them:');
    for (const action of shown) {
        const note = action.mayBeDone ? ' (may already be done)' : '';
        console.log(`  - ${action.version}${note}: ${action.text}`);
    }
}

/**
 * What the server lacks to accept the writes of a browser, or null: SvelteKit refuses them with 403
 * unless it knows the URL the browser uses. server.js turns ORIGIN into PROTOCOL_HEADER and
 * HOST_HEADER, which a reverse proxy can also set; without either, adapter-node assumes https and
 * the Host header, which only fits a few proxies, so it is worth a warning, not a refusal.
 */
export function missingPrerequisite(
    env: Record<string, string | undefined> = process.env,
    isDev = dev
): 'origin' | 'server-js' | null {
    // The dev server knows its own origin. Either header alone can be right: without
    // PROTOCOL_HEADER, adapter-node assumes https, which fits a proxy that serves https.
    if (isDev || env.PROTOCOL_HEADER || env.HOST_HEADER) return null;
    // Set but not applied: the app was started without server.js, as `node build`.
    return env.ORIGIN ? 'server-js' : 'origin';
}

export function logMissingPrerequisite(): void {
    const missing = missingPrerequisite();
    if (missing === 'origin') {
        console.warn(
            `⚠️ ORIGIN is not set, nor PROTOCOL_HEADER and HOST_HEADER: every save, import, upload or delete from the browser may be refused with 403. Set ORIGIN to the URL you open Cellar with, such as ORIGIN=http://192.168.1.20:3005, and restart Cellar. See ${ORIGIN_DOC}`
        );
    } else if (missing === 'server-js') {
        console.warn(
            '⚠️ ORIGIN is set but not applied, because Cellar was not started with `node server.js` (for example with `node build`): every save, import, upload or delete from the browser may be refused with 403. Start it with `node server.js`.'
        );
    }
}

/** What the admin banner shows: the upgrade actions left to tick, and a missing prerequisite. */
export function getUpgradeNotice() {
    const actions = withText(readPendingActions().filter((action) => !action.done));
    return { actions, prerequisite: missingPrerequisite() };
}

export type UpgradeNotice = ReturnType<typeof getUpgradeNotice>;

/** Ticks or unticks an action, and returns it as saved; undefined when it is not in the list. */
export function setUpgradeActionDone(
    version: string,
    index: number,
    done: boolean
): PendingAction | undefined {
    // Synchronous from the read to the write, so that two ticks cannot interleave.
    const pending = readPendingActions();
    const action = pending.find((entry) => entry.version === version && entry.index === index);
    if (!action) return undefined;
    action.done = done;
    setAppSetting(UPGRADE_ACTIONS_KEY, JSON.stringify(pending));
    return action;
}
