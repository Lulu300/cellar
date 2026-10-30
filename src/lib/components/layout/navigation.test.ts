import { describe, expect, it } from 'vitest';
import { isCurrentSection } from './navigation.js';

describe('isCurrentSection', () => {
    it('matches the page of the link and the pages under it', () => {
        expect(isCurrentSection('/wines', '/wines')).toBe(true);
        expect(isCurrentSection('/wines/42', '/wines')).toBe(true);
        expect(isCurrentSection('/admin/settings', '/admin')).toBe(true);
    });

    it('does not match a page whose path only starts with the same letters', () => {
        expect(isCurrentSection('/wine-shortage', '/wines')).toBe(false);
        expect(isCurrentSection('/wines-archive', '/wines')).toBe(false);
        expect(isCurrentSection('/storage', '/wines')).toBe(false);
    });
});
