/**
 * Sheets of labels: page sizes, where the labels go, and whether a layout can be printed. The
 * barcode page checks a layout as the user types with the code that the server runs before it
 * prints the PDF, so that both always agree.
 */
import {
    BARCODE_LENGTH,
    code128ModuleWidth,
    generateCODE128Pattern,
    MIN_MODULE_WIDTH
} from './barcode.js';
import type { LabelLayout } from '#lib/shared/schemas/label.js';

/** The page formats, with their size in mm. */
export const PAGE_SIZES = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    Letter: { width: 215.9, height: 279.4 },
    Legal: { width: 215.9, height: 355.6 }
} as const;

export type PageFormat = keyof typeof PAGE_SIZES;

export const PAGE_FORMATS = Object.keys(PAGE_SIZES) as [PageFormat, ...PageFormat[]];

export const CODE_TYPES = ['barcode', 'qrcode'] as const;

export type CodeType = (typeof CODE_TYPES)[number];

const TEXT_HEIGHT = 4; // in mm, the code value printed under the code
export const TEXT_GAP = 1; // in mm, between the code and its value

/** The height, in mm, that the code value takes under the code. */
export const codeValueSpace = (showCodeValue: boolean) =>
    showCodeValue ? TEXT_HEIGHT + TEXT_GAP : 0;

/**
 * The height, in mm, of the code that the PDF draws on a label of `layout`, and that
 * checkLabelLayout checks: the bars fill the label above the code value, and a QR code is square.
 */
export function codeHeight(layout: LabelLayout): number {
    const padding = layout.labelPadding;
    const height = layout.labelHeight - 2 * padding - codeValueSpace(layout.showCodeValue);
    if (layout.codeType === 'barcode') return height;
    return Math.min(layout.labelWidth - 2 * padding, height);
}

/**
 * How far, in mm, labels may reach into a margin. The labels of a sheet such as Avery's fill it
 * exactly: measures rounded to the micrometre, or floating-point arithmetic, must not cost a row.
 */
const FIT_TOLERANCE = 0.01;

/** How many labels fit across and down a page of `layout`. */
export function labelGrid(layout: LabelLayout): { columns: number; rows: number } {
    const page = PAGE_SIZES[layout.pageFormat];
    const usableWidth = page.width - layout.marginLeft - layout.marginRight + FIT_TOLERANCE;
    const usableHeight = page.height - layout.marginTop - layout.marginBottom + FIT_TOLERANCE;
    // n labels take n sizes and n - 1 spacings.
    return {
        columns: Math.floor(
            (usableWidth + layout.horizontalSpacing) /
                (layout.labelWidth + layout.horizontalSpacing)
        ),
        rows: Math.floor(
            (usableHeight + layout.verticalSpacing) / (layout.labelHeight + layout.verticalSpacing)
        )
    };
}

/** What can be wrong with a layout; the barcode page has a message for each. */
export type LabelIssueCode =
    | 'invalid_values'
    | 'labels_do_not_fit'
    | 'module_width_below_minimum'
    | 'module_width_below_recommended'
    | 'height_below_minimum'
    | 'height_below_recommended'
    | 'qr_size_below_minimum'
    | 'qr_size_below_recommended'
    | 'qr_label_not_square';

export interface LabelIssue {
    code: LabelIssueCode;
    /** Whether the labels cannot be printed: the server refuses them. */
    blocking: boolean;
    /** The measure that is too small and the size it should reach, in mm. */
    values?: { actual: number; limit: number };
}

/** Every code that the app prints has BARCODE_LENGTH characters, each 11 modules wide. */
const BARCODE_MODULE_COUNT = generateCODE128Pattern('0'.repeat(BARCODE_LENGTH)).length;

const RECOMMENDED_MODULE_WIDTH = 0.5;
// The bars of a Brother DK-11204 label, which every scanner of the audit's bench read: the shipped
// preset keeps printing (decision of 2026-10-28).
const MIN_BARCODE_HEIGHT = 10;
const RECOMMENDED_BARCODE_HEIGHT = 25;
const MIN_QR_SIZE = 10;
const RECOMMENDED_QR_SIZE = 15;

/**
 * The size check of a measure: blocking under `min`, a warning under `recommended`, nothing
 * otherwise.
 */
function sizeIssue(
    actual: number,
    [min, recommended]: [number, number],
    [belowMin, belowRecommended]: [LabelIssueCode, LabelIssueCode]
): LabelIssue[] {
    if (actual < min) return [{ code: belowMin, blocking: true, values: { actual, limit: min } }];
    if (actual < recommended) {
        return [
            { code: belowRecommended, blocking: false, values: { actual, limit: recommended } }
        ];
    }
    return [];
}

/**
 * What prevents the labels of `layout` from being printed (blocking issues), or from scanning
 * well (warnings), measured as the PDF draws them: a barcode gets its module width, quiet zones
 * included, and the height of codeHeight.
 */
export function checkLabelLayout(layout: LabelLayout): LabelIssue[] {
    const issues: LabelIssue[] = [];
    const { columns, rows } = labelGrid(layout);
    if (columns < 1 || rows < 1) issues.push({ code: 'labels_do_not_fit', blocking: true });

    if (layout.codeType === 'barcode') {
        const moduleWidth = code128ModuleWidth(
            BARCODE_MODULE_COUNT,
            layout.labelWidth,
            layout.labelPadding
        );
        issues.push(
            ...sizeIssue(
                moduleWidth,
                [MIN_MODULE_WIDTH, RECOMMENDED_MODULE_WIDTH],
                ['module_width_below_minimum', 'module_width_below_recommended']
            ),
            ...sizeIssue(
                codeHeight(layout),
                [MIN_BARCODE_HEIGHT, RECOMMENDED_BARCODE_HEIGHT],
                ['height_below_minimum', 'height_below_recommended']
            )
        );
    } else {
        issues.push(
            ...sizeIssue(
                codeHeight(layout),
                [MIN_QR_SIZE, RECOMMENDED_QR_SIZE],
                ['qr_size_below_minimum', 'qr_size_below_recommended']
            )
        );
        if (Math.abs(layout.labelWidth - layout.labelHeight) > 2) {
            issues.push({ code: 'qr_label_not_square', blocking: false });
        }
    }
    return issues;
}

/** The issues that prevent printing the labels of `layout`: the server refuses them. */
export function blockingIssues(layout: LabelLayout): LabelIssue[] {
    return checkLabelLayout(layout).filter((issue) => issue.blocking);
}
