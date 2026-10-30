import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { LabelOptions } from './label-options.svelte.js';

/** Options whose layout prints without a warning: 90 × 34 mm barcodes on A4. */
function printableOptions() {
    const options = new LabelOptions(() => 'CV');
    options.layout = { ...options.layout, labelWidth: 90, labelHeight: 34 };
    return options;
}

// The server refuses to save a preset that the PDF cannot print; the page says so first.
describe('whether the layout can be saved as a preset', () => {
    it('holds for labels that print', () => {
        expect(printableOptions().layoutPrintable).toBe(true);
    });

    it.each([
        ['too narrow for their barcode', { labelWidth: 50 }],
        ['larger than the page', { labelWidth: 400 }],
        ['with an emptied field', { labelHeight: null as unknown as number }]
    ])('fails for labels %s', (_, changes) => {
        const options = printableOptions();
        options.layout = { ...options.layout, ...changes };

        expect(options.layoutPrintable).toBe(false);
    });

    // The preset buttons name them: on a phone, the list under the form is a screen away.
    it('names what prevents saving it', () => {
        const options = printableOptions();
        options.layout = { ...options.layout, labelWidth: 50, labelHeight: 30 };

        expect(options.layoutErrors.map((issue) => issue.code)).toEqual([
            'module_width_below_minimum'
        ]);
    });

    // A preset holds no range of codes.
    it('ignores the range of codes, which a preset does not save', () => {
        const options = printableOptions();
        options.count = null as unknown as number;

        expect(options.printable).toBe(false);
        expect(options.layoutPrintable).toBe(true);
    });

    // The preset's reason points to the errors under the form: the layout's must be there.
    it('lists the errors of the layout along with an invalid range', () => {
        const options = printableOptions();
        options.layout = { ...options.layout, labelWidth: 50 };
        options.count = null as unknown as number;

        expect(options.issues.map((issue) => issue.code)).toEqual([
            'module_width_below_minimum',
            'invalid_values'
        ]);
    });

    it('lists an invalid value once', () => {
        const options = printableOptions();
        options.layout = { ...options.layout, labelWidth: null as unknown as number };
        options.count = null as unknown as number;

        expect(options.issues.map((issue) => issue.code)).toEqual(['invalid_values']);
    });
});

// The barcode page opens on this layout: it must print, at the narrowest whole millimetre.
describe('the default layout', () => {
    it('prints barcodes and can be saved', () => {
        const options = new LabelOptions(() => 'CV');

        expect(options.issues.filter((issue) => issue.blocking)).toEqual([]);
        expect(options.layoutPrintable).toBe(true);
        expect(options.layout.codeType).toBe('barcode');
    });

    it('is as narrow as a barcode allows', () => {
        const options = new LabelOptions(() => 'CV');
        options.layout.labelWidth -= 1;

        expect(options.issues.map((issue) => issue.code)).toContain('module_width_below_minimum');
    });
});

// The fields say which number they expect, instead of a general "some values are invalid".
describe('the message of each field', () => {
    const between = (min: string, max: string) => m['form_errors.number_between']({ min, max });

    it('says nothing while the fields are valid', () => {
        expect(new LabelOptions(() => 'CV').fieldErrors).toEqual({});
    });

    it.each<[string, Record<string, unknown>, Record<string, string>]>([
        ['an emptied margin', { marginTop: null }, { marginTop: between('0', '500') }],
        ['a text', { marginLeft: '1e' }, { marginLeft: between('0', '500') }],
        [
            'a spacing out of bounds',
            { horizontalSpacing: 501 },
            { horizontalSpacing: between('0', '500') }
        ],
        // A width of 0 is refused: the message must not offer it.
        [
            'a width of 0',
            { labelWidth: 0 },
            { labelWidth: m['form_errors.number_above_up_to']({ min: '0', max: '500' }) }
        ]
    ])('names %s', (_, changes, expected) => {
        const options = new LabelOptions(() => 'CV');
        Object.assign(options.layout, changes);

        expect(options.fieldErrors).toEqual(expected);
    });

    it('names the range of codes', () => {
        const options = new LabelOptions(() => 'CV');
        options.count = 1001;
        options.startNumber = null as unknown as number;

        expect(options.fieldErrors).toEqual({
            count: m['form_errors.whole_number_between']({ min: '1', max: '1,000' }),
            startNumber: m['form_errors.whole_number_between']({ min: '1', max: '99,999,999' })
        });
    });

    // ABCDEF leaves 4 digits: numbers go up to 9,999.
    it('bounds the start number by what the prefix allows', () => {
        const options = new LabelOptions(() => 'ABCDEF');
        options.startNumber = 99_999;

        expect(options.printable).toBe(false);
        expect(options.fieldErrors).toEqual({
            startNumber: m['form_errors.whole_number_between']({ min: '1', max: '9,999' })
        });
    });

    it('says how many codes are left after the start number', () => {
        const options = new LabelOptions(() => 'ABCDEF');
        options.startNumber = 9_990;

        expect(options.printable).toBe(false);
        expect(options.fieldErrors).toEqual({
            count: m['form_errors.whole_number_between']({ min: '1', max: '10' })
        });
        options.count = 10;
        expect(options.printable).toBe(true);
    });

    // The page asks to change such a prefix: its fields must not invent a bound from it.
    it('bounds no range by a prefix that an old version saved longer than 6 characters', () => {
        const options = new LabelOptions(() => 'OLDWINES01');

        expect(options.fieldErrors).toEqual({});
    });

    // A number, but not a whole one: the field says what it lacks.
    it('asks for a whole start number', () => {
        const options = new LabelOptions(() => 'CV');
        options.startNumber = 1.5;

        expect(options.fieldErrors).toEqual({
            startNumber: m['form_errors.whole_number_between']({ min: '1', max: '99,999,999' })
        });
    });
});
