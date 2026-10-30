import { describe, expect, it } from 'vitest';
import { pieSlices } from './pie-chart';

describe('pieSlices', () => {
    // An SVG arc that starts and ends at the same point draws nothing.
    it('draws a single category as a full circle', () => {
        expect(pieSlices([12])).toEqual([{ full: true }]);
    });

    it('starts at 12 o’clock and goes clockwise, with the large arc above 50 %', () => {
        expect(pieSlices([3, 1])).toEqual([
            { full: false, path: 'M 100 100 L 100 20 A 80 80 0 1 1 20 100 Z' },
            { full: false, path: 'M 100 100 L 20 100 A 80 80 0 0 1 100 20 Z' }
        ]);
    });

    // A zero slice would still draw its white border as a line across the pie.
    it('draws nothing for a zero count, next to a full slice', () => {
        expect(pieSlices([0, 5])).toEqual([null, { full: true }]);
        expect(pieSlices([5, 0])).toEqual([{ full: true }, null]);
    });
});
