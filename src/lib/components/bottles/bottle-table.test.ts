import { describe, expect, it } from 'vitest';
import { nextSort } from './bottle-table';

describe('nextSort', () => {
    it('turns the direction round on the same column', () => {
        expect(nextSort({ column: 'vintage', direction: 'asc' }, 'vintage')).toEqual({
            column: 'vintage',
            direction: 'desc'
        });
    });

    it('starts another column in its default direction: the newest first for a date', () => {
        expect(nextSort({ column: 'vintage', direction: 'desc' }, 'barcode').direction).toBe('asc');
        expect(nextSort({ column: 'vintage', direction: 'asc' }, 'purchaseDate').direction).toBe(
            'desc'
        );
    });
});
