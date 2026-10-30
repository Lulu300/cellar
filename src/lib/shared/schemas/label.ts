import { z } from 'zod';
import { maxBarcodeNumber } from '#lib/shared/barcode.js';
import { CODE_TYPES, PAGE_FORMATS } from '#lib/shared/labels.js';
import { name, optionalText } from './common.js';

/** A distance on the page, in mm. */
const distance = z.number().nonnegative().max(500);

/** How labels are laid out on a page, in mm: what a preset saves and the PDF prints. */
export const labelLayoutSchema = z.object({
    pageFormat: z.enum(PAGE_FORMATS),
    labelWidth: z.number().positive().max(500),
    labelHeight: z.number().positive().max(500),
    marginTop: distance,
    marginLeft: distance,
    marginBottom: distance,
    marginRight: distance,
    labelPadding: distance,
    horizontalSpacing: distance,
    verticalSpacing: distance,
    codeType: z.enum(CODE_TYPES),
    showCodeValue: z.boolean(),
    // A light gray outline to preview the cut; presets saved before it had none.
    showBorder: z.boolean().default(false)
});

export type LabelLayout = z.output<typeof labelLayoutSchema>;

export const labelPresetSchema = labelLayoutSchema.extend({
    name,
    description: optionalText(500)
});

export type LabelPresetInput = z.output<typeof labelPresetSchema>;

/** The codes a label export lists: `count` numbers from `startNumber`. */
export const labelRangeSchema = z.object({
    startNumber: z.int().min(1),
    count: z.int().min(1).max(1000),
    // Only read when automatic barcodes are off; checked then.
    prefix: z.string().max(100).nullish()
});

/**
 * labelRangeSchema for the codes of `prefix`: every number of the range fits after the prefix, as
 * formatBarcodeRange requires. The barcode page checks a range with it before asking for the file;
 * the server refuses the same ranges, once it knows the prefix it uses, with barcode_out_of_range.
 */
export function prefixRangeSchema(prefix: string) {
    const max = maxBarcodeNumber(prefix);
    return labelRangeSchema
        .extend({ startNumber: labelRangeSchema.shape.startNumber.max(max) })
        .refine(({ startNumber, count }) => startNumber + count - 1 <= max, {
            path: ['count'],
            // Once each field is valid: a start past the end already says what is wrong.
            when: (payload) => payload.issues.length === 0
        });
}

/**
 * What a request for a sheet of labels gives. Whether its labels can be printed is checked next,
 * by checkLabelLayout.
 */
export const labelSheetSchema = labelLayoutSchema.extend({
    ...labelRangeSchema.shape,
    horizontalSpacing: distance.default(2),
    verticalSpacing: distance.default(2),
    labelPadding: distance.default(2),
    codeType: labelLayoutSchema.shape.codeType.default('barcode'),
    showCodeValue: z.boolean().default(true)
});

export type LabelSheet = z.output<typeof labelSheetSchema>;
