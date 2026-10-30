import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { barcodePrefixError } from './prefix-error';

describe('barcodePrefixError', () => {
    it('asks to change a saved prefix longer than 6 characters', () => {
        expect(barcodePrefixError('OLDWINES01', true)).toBe(m['errors.barcode_prefix_too_long']());
    });

    // The server prints the codes of a saved prefix that an old version did not check.
    it('accepts a saved prefix of 6 characters or less, whatever its characters', () => {
        expect(barcodePrefixError('CV_', true)).toBeUndefined();
    });

    it('refuses a typed prefix that the server would refuse', () => {
        expect(barcodePrefixError('AB C', false)).toBe(m['errors.invalid_barcode_prefix']());
        expect(barcodePrefixError('ABCDEFG', false)).toBe(m['errors.invalid_barcode_prefix']());
    });

    // The page shows no card until a prefix is typed.
    it('says nothing of an empty typed prefix', () => {
        expect(barcodePrefixError('', false)).toBeUndefined();
    });
});
