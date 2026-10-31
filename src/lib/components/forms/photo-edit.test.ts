import { describe, expect, it } from 'vitest';
import { croppedSize, FULL_CROP, moveCrop, resizeCrop, turnCrop, type Crop } from './photo-edit';

const crop: Crop = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

/** `crop` with its values rounded, as floating point leaves them a hair off. */
const rounded = (value: Crop) =>
    Object.fromEntries(Object.entries(value).map(([key, n]) => [key, Math.round(n * 1000) / 1000]));

describe('turnCrop', () => {
    it('keeps the same part of the photo once turned a quarter clockwise', () => {
        // The top left part of a photo is at its top right once turned.
        expect(rounded(turnCrop(crop))).toEqual({ x: 0.4, y: 0.1, width: 0.4, height: 0.3 });
    });

    it('comes back to the crop after four quarters', () => {
        expect(rounded(turnCrop(turnCrop(turnCrop(turnCrop(crop)))))).toEqual(crop);
        expect(turnCrop(FULL_CROP)).toEqual(FULL_CROP);
    });
});

describe('moveCrop', () => {
    it('moves the frame, and stops it at the edges of the photo', () => {
        expect(rounded(moveCrop(crop, 0.1, 0.1))).toEqual({ ...crop, x: 0.2, y: 0.3 });
        expect(rounded(moveCrop(crop, 1, -1))).toEqual({ ...crop, x: 0.7, y: 0 });
    });
});

describe('resizeCrop', () => {
    it('moves the corner dragged, and only the edges it joins', () => {
        expect(rounded(resizeCrop(crop, 'se', 0.1, 0.1))).toEqual({
            x: 0.1,
            y: 0.2,
            width: 0.4,
            height: 0.5
        });
        expect(rounded(resizeCrop(crop, 'nw', 0.1, -0.1))).toEqual({
            x: 0.2,
            y: 0.1,
            width: 0.2,
            height: 0.5
        });
    });

    it('keeps the frame inside the photo, and never smaller than a tenth of it', () => {
        expect(rounded(resizeCrop(crop, 'ne', 2, -2))).toEqual({
            x: 0.1,
            y: 0,
            width: 0.9,
            height: 0.6
        });
        expect(rounded(resizeCrop(crop, 'sw', 1, -1))).toEqual({
            x: 0.3,
            y: 0.2,
            width: 0.1,
            height: 0.1
        });
    });
});

describe('croppedSize', () => {
    const phone = { width: 4000, height: 3000 };

    it('shrinks a photo to 1,600 pixels on its longest side', () => {
        expect(croppedSize(phone, 0, FULL_CROP, 1600)).toEqual({ width: 1600, height: 1200 });
    });

    it('swaps the sides of a photo turned a quarter', () => {
        expect(croppedSize(phone, 1, FULL_CROP, 1600)).toEqual({ width: 1200, height: 1600 });
        expect(croppedSize(phone, 2, FULL_CROP, 1600)).toEqual({ width: 1600, height: 1200 });
    });

    it('gives the size of the part kept, never enlarged', () => {
        const quarter = { x: 0, y: 0, width: 0.25, height: 0.5 };

        expect(croppedSize(phone, 0, quarter, 1600)).toEqual({ width: 1000, height: 1500 });
        expect(croppedSize({ width: 800, height: 600 }, 0, FULL_CROP, 1600)).toEqual({
            width: 800,
            height: 600
        });
    });
});
