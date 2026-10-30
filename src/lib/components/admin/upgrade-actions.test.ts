import { describe, expect, it } from 'vitest';
import { keepShown, type UpgradeAction } from './upgrade-actions.js';

const action = (version: string, index: number): UpgradeAction => ({
    version,
    index,
    mayBeDone: false,
    done: false,
    text: `Action ${index} of ${version}`
});

describe('keepShown', () => {
    it('keeps a ticked action that the data read again leaves out', () => {
        const shown = [action('0.2.0', 0), action('0.2.0', 1)];

        expect(keepShown(shown, [action('0.2.0', 1)])).toEqual(shown);
        expect(keepShown(shown, [])).toEqual(shown);
    });

    it('adds the actions that were not shown yet, after the others', () => {
        const shown = [action('0.2.0', 0)];

        expect(keepShown(shown, [action('0.3.0', 0), action('0.2.0', 0)])).toEqual([
            action('0.2.0', 0),
            action('0.3.0', 0)
        ]);
    });
});
