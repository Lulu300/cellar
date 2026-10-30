import { describe, expect, it } from 'vitest';
import { formNumbers } from './form';

/** What formNumbers reads from a field `price` that holds `text`. */
const read = (text: string) => {
    const form = new FormData();
    form.set('price', text);
    return formNumbers(form, ['price']).price;
};

describe('formNumbers', () => {
    it.each([
        ['12,5', 12.5],
        ['12.5', 12.5],
        [' 2016 ', 2016],
        ['12,', 12],
        [',5', 0.5],
        ['-3', -3]
    ])('reads "%s" as %s', (text, number) => {
        expect(read(text)).toBe(number);
    });

    it.each(['', '   '])('reads "%s" as null', (text) => {
        expect(read(text)).toBeNull();
    });

    it.each(['1e', '1-', '1e3', '0x10', 'Infinity', '1,234.5', '1.2.3', '12 €', '-', ','])(
        'passes "%s" on as text, for the schema to refuse it',
        (text) => {
            expect(read(text)).toBe(text);
        }
    );

    it('passes on as text a number too long to read, rather than Infinity', () => {
        const digits = '1'.repeat(400);
        expect(read(digits)).toBe(digits);
    });

    it('leaves out a field the form lacks', () => {
        expect(formNumbers(new FormData(), ['price'])).toEqual({});
    });
});
