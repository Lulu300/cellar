import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { seed } from '#lib/server/db/seed.js';
import type { LabelPreset } from '#lib/server/db/schema.js';
import { checkLabelLayout, labelGrid } from '#lib/shared/labels.js';
import { labelSheetSchema, type LabelSheet } from '#lib/shared/schemas/label.js';
import { generateLabelsPdf } from './pdf';
import { listPresets } from './service';

/** The sheet of `preset` with one label per place of its page. */
function fullPage(preset: LabelPreset): LabelSheet {
    const sheet = labelSheetSchema.parse({ ...preset, startNumber: 1, count: 1 });
    const { columns, rows } = labelGrid(sheet);
    return { ...sheet, count: columns * rows };
}

const pdfText = (sheet: LabelSheet) => generateLabelsPdf(sheet).pdf.toString('latin1');

const pageCount = (pdf: string) => pdf.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

/** The heights of the filled rectangles of `pdf`, in mm: "x y width -height re". */
const rectHeights = (pdf: string) =>
    [...pdf.matchAll(/ -([\d.]+) re\n/g)].map(([, height]) => (Number(height) * 25.4) / 72);

// The presets of scripts/data/label_presets.csv, as a new installation gets them.
describe('the shipped label presets', () => {
    let presets: LabelPreset[] = [];
    let warnings: unknown[][] = [];
    beforeAll(() => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        seed(db);
        warnings = warn.mock.calls;
        warn.mockRestore();
        presets = listPresets();
    });
    const shipped = (name: string) => presets.find((preset) => preset.name === name)!;

    // The seeding leaves aside, with a warning, a row that the preset API would refuse.
    it('are all seeded', () => {
        const rows = readFileSync('scripts/data/label_presets.csv', 'utf8').trim().split('\n');

        expect(warnings).toEqual([]);
        expect(presets).toHaveLength(rows.length - 1);
    });

    it('each print a full page of labels', () => {
        const pages = Object.fromEntries(
            presets.map((preset) => {
                try {
                    return [preset.name, pageCount(pdfText(fullPage(preset)))];
                } catch (error) {
                    return [preset.name, String(error)];
                }
            })
        );
        expect(pages).toEqual(Object.fromEntries(presets.map((preset) => [preset.name, 1])));
    });

    // The bars of the narrowest preset are as high as the page checks them: 17 mm, less the
    // padding and the code value under them.
    it('draws the bars of Brother DK-11204 at the height that the page checks', () => {
        const sheet = { ...fullPage(shipped('Brother DK-11204')), count: 1 };

        expect(checkLabelLayout(sheet)).toContainEqual({
            code: 'height_below_recommended',
            blocking: false,
            values: { actual: 10, limit: 25 }
        });
        const heights = new Set(rectHeights(pdfText(sheet)).map((height) => height.toFixed(3)));
        expect([...heights]).toEqual(['10.000']);
    });

    // Bars used to stop at 30% of the label width, under the height that the page checked.
    it('draws the bars of a wide label as high as the label allows', () => {
        const sheet = { ...fullPage(shipped('Brother DK-11202')), count: 1 };

        // 62 mm, less 2 × 1 mm of padding and 5 mm for the code value
        expect(checkLabelLayout(sheet)).toEqual([]);
        const heights = new Set(rectHeights(pdfText(sheet)).map((height) => height.toFixed(3)));
        expect([...heights]).toEqual(['55.000']);
    });

    // The labels of each Avery sheet, from its template on avery.com.
    it.each([
        ['Avery 5160', 3, 10],
        ['Avery 5161', 2, 10],
        ['Avery 5162', 2, 7],
        ['Avery 5163', 2, 5],
        ['Avery 5164', 2, 3],
        ['Avery 8160', 3, 10]
    ])('fill every label of an %s sheet: %i × %i', (name, columns, rows) => {
        const sheet = fullPage(shipped(name));

        expect(labelGrid(sheet)).toEqual({ columns, rows });
        expect(pageCount(pdfText({ ...sheet, count: columns * rows + 1 }))).toBe(2);
    });

    // The label outlines of Avery's templates (avery.com/templates/<part>), in pt: the left edge of
    // each column, the label width, the top of the first row from the top of the page, the pitch
    // down and the rows. U-0087-01.pdf for 5160, U-0089-01.pdf for 5162. The 5160 width is the
    // nominal 2 5/8 in: its template draws the outlines 0.36 pt wider.
    it.each([
        ['Avery 5160', [13.5, 211.5, 409.5], 189, 36, 72, 10],
        ['Avery 5162', [11.2, 312.7], 288, 59.95, 96, 7]
    ])(
        'print %s labels on the die cuts of its template',
        (name, lefts, width, top, pitch, rows) => {
            const pdf = pdfText({ ...fullPage(shipped(name)), showBorder: true });

            // The border draws the top and the bottom edge of each label as a line, in pt from the
            // bottom of the page: "x1 y m x2 y l S".
            const edges = [...pdf.matchAll(/([\d.]+) ([\d.]+) m\n([\d.]+) \2 l\nS/g)].map(
                ([, x1, y, x2]) => ({ left: Number(x1), right: Number(x2), top: 792 - Number(y) })
            );
            // How far the edges are from their nearest cut, and the cuts that no edge falls on.
            const againstCuts = (values: number[], cuts: number[]) => ({
                farthest: Math.max(
                    ...values.map((value) => Math.min(...cuts.map((cut) => Math.abs(value - cut))))
                ),
                missed: cuts.filter((cut) => !values.some((value) => Math.abs(value - cut) < 0.05))
            });
            // Within 0.05 pt (0.02 mm): the templates themselves are drawn to 0.05 pt.
            const onCuts = { farthest: expect.closeTo(0, 1), missed: [] };
            const cutTops = Array.from({ length: rows + 1 }, (_, row) => top + pitch * row);

            expect(edges).toHaveLength(2 * lefts.length * rows);
            expect(
                againstCuts(
                    edges.map((edge) => edge.left),
                    lefts
                )
            ).toEqual(onCuts);
            expect(
                againstCuts(
                    edges.map((edge) => edge.right - edge.left),
                    [width]
                )
            ).toEqual(onCuts);
            expect(
                againstCuts(
                    edges.map((edge) => edge.top),
                    cutTops
                )
            ).toEqual(onCuts);
        }
    );
});
