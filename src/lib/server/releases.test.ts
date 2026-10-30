import { describe, expect, it } from 'vitest';
import { checkReleases, compareVersions, upgradeSteps, type Release } from './releases.js';

const release = (version: string, mandatoryStop = false): Release => ({
    version,
    summary: `Version ${version}.`,
    mandatoryStop,
    actions: [`Action of ${version}.`]
});

// Newest first, as in releases.json.
const releases = [release('0.4.0'), release('0.3.0', true), release('0.2.0'), release('0.1.0')];

describe('compareVersions', () => {
    it('orders release candidates before their final version', () => {
        expect(compareVersions('0.2.0-rc.1', '0.2.0')).toBe(-1);
        expect(compareVersions('0.2.0-rc.2', '0.2.0-rc.10')).toBe(-1);
        expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('refuses what is not X.Y.Z or X.Y.Z-rc.N', () => {
        expect(() => compareVersions('0.2', '0.2.0')).toThrow('Invalid version "0.2"');
    });
});

describe('upgradeSteps', () => {
    it('lists the releases after the first version up to the second, oldest first', () => {
        const { steps } = upgradeSteps(releases, '0.1.0', '0.3.0');

        expect(steps.map((step) => step.version)).toEqual(['0.2.0', '0.3.0']);
    });

    it('counts a release candidate as its final version', () => {
        expect(upgradeSteps(releases, '0.2.0-rc.1', '0.2.0').steps).toEqual([]);
        expect(upgradeSteps(releases, '0.1.0', '0.2.0-rc.3').steps).toEqual([release('0.2.0')]);
    });

    it('starts from a release candidate whose entry was renamed to a later version', () => {
        // A build of develop called itself 0.5.0-rc.0, then the next release became 1.0.0.
        const renamed = [release('1.0.0'), ...releases];

        expect(upgradeSteps(renamed, '0.5.0-rc.0', '1.0.0').steps).toEqual([release('1.0.0')]);
    });

    it('names a mandatory stop that the upgrade passes, not one it ends on or starts from', () => {
        expect(upgradeSteps(releases, '0.1.0', '0.4.0').stops).toEqual(['0.3.0']);
        expect(upgradeSteps(releases, '0.1.0', '0.3.0').stops).toEqual([]);
        expect(upgradeSteps(releases, '0.3.0', '0.4.0').stops).toEqual([]);
    });
});

describe('checkReleases', () => {
    it('refuses entries that are not sorted from newest to oldest', () => {
        expect(() => checkReleases([release('0.1.0'), release('0.2.0')])).toThrow(
            'entries must be sorted from newest to oldest'
        );
    });
});
