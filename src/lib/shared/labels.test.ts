import { describe, expect, it } from 'vitest';
import { checkLabelLayout, labelGrid, type LabelIssueCode } from './labels';
import type { LabelLayout } from './schemas/label';

/** An A4 sheet of 90 × 34 mm barcode labels, without problem. */
const layout: LabelLayout = {
    pageFormat: 'A4',
    labelWidth: 90,
    labelHeight: 34,
    marginTop: 10,
    marginLeft: 10,
    marginBottom: 10,
    marginRight: 10,
    labelPadding: 2,
    horizontalSpacing: 2,
    verticalSpacing: 2,
    codeType: 'barcode',
    showCodeValue: true,
    showBorder: false
};

const codes = (changes: Partial<LabelLayout>) =>
    checkLabelLayout({ ...layout, ...changes }).map((issue) => issue.code);

const blocking = (changes: Partial<LabelLayout>) =>
    checkLabelLayout({ ...layout, ...changes })
        .filter((issue) => issue.blocking)
        .map((issue) => issue.code);

describe('labelGrid', () => {
    it('fits n labels and n - 1 spacings between the margins', () => {
        // 190 mm wide: 2 × 90 + 2; 277 mm high: 7 × 34 + 6 × 2 = 250, 8 × 34 + 7 × 2 = 286
        expect(labelGrid(layout)).toEqual({ columns: 2, rows: 7 });
    });

    // Avery 5162: seven 1 1/3 in rows between 0.83 in margins, in mm rounded to the micrometre.
    it('counts the labels that fill the page exactly, despite the rounding', () => {
        const avery = {
            ...layout,
            pageFormat: 'Letter' as const,
            labelWidth: 101.6,
            labelHeight: 33.867,
            marginTop: 21.149,
            marginLeft: 3.951,
            marginBottom: 21.184,
            marginRight: 3.986,
            horizontalSpacing: 4.763,
            verticalSpacing: 0
        };
        expect(labelGrid(avery)).toEqual({ columns: 2, rows: 7 });
        expect(labelGrid({ ...avery, labelHeight: 33.87 })).toEqual({ columns: 2, rows: 6 });
    });
});

describe('checkLabelLayout', () => {
    it('finds nothing wrong with a large enough label', () => {
        expect(checkLabelLayout(layout)).toEqual([]);
    });

    it.each<[string, Partial<LabelLayout>]>([
        ['wider than the page between its margins', { labelWidth: 191 }],
        ['higher than the page between its margins', { labelHeight: 278 }],
        ['under margins that leave no room', { marginLeft: 150, marginRight: 150 }]
    ])('refuses labels %s', (_, changes) => {
        expect(blocking(changes)).toContain('labels_do_not_fit');
    });

    it('refuses barcode modules under 0.33 mm', () => {
        // The default form: 50 mm leave 42 mm for 145 modules
        const [issue] = checkLabelLayout({ ...layout, labelWidth: 50 });
        expect(issue).toMatchObject({
            code: 'module_width_below_minimum',
            blocking: true,
            values: { limit: 0.33 }
        });
        expect(issue.values?.actual).toBeCloseTo(42 / 145);
    });

    // The bars keep 10 modules of white on each side: on an 82 mm label they are narrower than
    // the padding alone would make them.
    it('warns about bars under the recommended width once the quiet zones are counted', () => {
        expect(codes({ labelWidth: 82 })).toEqual(['module_width_below_recommended']);
        expect(codes({ labelWidth: 82.5 })).toEqual([]);
    });

    // 2 × 2 mm of padding, and 5 mm for the code value under the bars
    it.each<[number, LabelIssueCode[]]>([
        [18, ['height_below_minimum']],
        [19, ['height_below_recommended']],
        [33, ['height_below_recommended']],
        [34, []]
    ])('checks the height that a %s mm label leaves to the bars', (labelHeight, expected) => {
        expect(codes({ labelHeight })).toEqual(expected);
    });

    it('gives the bars the height of the code value when it is hidden', () => {
        expect(codes({ labelHeight: 29, showCodeValue: false })).toEqual([]);
    });

    describe('a QR code', () => {
        const qr = (changes: Partial<LabelLayout>) =>
            codes({ codeType: 'qrcode', labelWidth: 30, labelHeight: 30, ...changes });

        it('is checked at the size that the PDF draws, above the code value', () => {
            // 26 mm wide, but 26 - 5 mm high under the code value
            expect(qr({ showCodeValue: false })).toEqual([]);
            expect(qr({ labelHeight: 22, labelWidth: 22, showCodeValue: false })).toEqual([]);
            expect(qr({ labelHeight: 22, labelWidth: 22 })).toEqual(['qr_size_below_recommended']);
            expect(qr({ labelHeight: 18, labelWidth: 18 })).toEqual(['qr_size_below_minimum']);
        });

        it('is refused when the padding leaves it no room', () => {
            expect(qr({ labelPadding: 15 })).toContain('qr_size_below_minimum');
        });

        it('suits square labels best', () => {
            expect(qr({ labelWidth: 40, showCodeValue: false })).toEqual(['qr_label_not_square']);
        });
    });
});
