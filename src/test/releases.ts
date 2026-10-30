import type { Release } from '#lib/server/releases.js';

/** A release with a made-up summary. */
export const release = (
    version: string,
    actions: string[] = [],
    mandatoryStop = false
): Release => ({
    version,
    summary: `Version ${version}.`,
    mandatoryStop,
    actions
});

/**
 * Made-up versions before 1.0.0, newest first. releases.json starts at 1.0.0, the first public
 * release, but the upgrade check still meets databases and backups of earlier versions, and judges
 * those that did not record their version from their migrations (`UNRECORDED_VERSIONS`, 0.1.0 to
 * 0.5.0): its tests need versions with actions before the current one.
 */
const OLD_RELEASES = [
    release('0.9.0', ['Do 0.9.0.']),
    release('0.8.0'),
    release('0.5.0', ['Do 0.5.0.']),
    release('0.4.0', ['Do 0.4.0.']),
    release('0.3.0', ['Do 0.3.0.']),
    release('0.2.0', [
        'Do 0.2.0 A.',
        'Do 0.2.0 B.',
        'Do 0.2.0 C.',
        'Do 0.2.0 D.',
        'Do 0.2.0 E.',
        'Do 0.2.0 F.'
    ]),
    release('0.1.0')
];

/**
 * The module of releases.json for `vi.mock`: its own entries, then the made-up older versions.
 * `stop` makes one of these a mandatory stop.
 */
export async function withOldReleases(
    importOriginal: <T>() => Promise<T>,
    stop?: string
): Promise<{ default: Release[] }> {
    const { default: releases } = await importOriginal<{ default: Release[] }>();
    return {
        default: [...releases, ...OLD_RELEASES].map((entry) =>
            entry.version === stop ? { ...entry, mandatoryStop: true } : entry
        )
    };
}
