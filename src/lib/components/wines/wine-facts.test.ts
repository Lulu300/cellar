import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { storageLocations } from './wine-facts';

const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;

describe('storageLocations', () => {
    // Found during FEAT-04, fixed in FEAT-12: a bottle out of the cellar counted in the case it kept.
    it('counts the bottles in the cellar only, not those that left their case', () => {
        const inRack1 = { storageCase: { name: 'Rack1' } };

        expect(
            storageLocations([
                { availability: AVAILABLE, ...inRack1 },
                { availability: OUT_OF_CELLAR, ...inRack1 },
                { availability: CONSUMED, ...inRack1 },
                { availability: AVAILABLE, storageCase: null }
            ])
        ).toEqual({ Rack1: 1, [m['common.not_available']()]: 1 });
    });
});
