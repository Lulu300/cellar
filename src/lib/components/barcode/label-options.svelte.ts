import type { z } from 'zod';
import type { LabelPreset } from '#lib/shared/dto.js';
import { issueErrors, type FieldErrors } from '#lib/components/forms/field-errors.js';
import { checkLabelLayout, type LabelIssue } from '#lib/shared/labels.js';
import {
    labelLayoutSchema,
    labelSheetSchema,
    type LabelLayout
} from '#lib/shared/schemas/label.js';
import { rangeErrors } from './range-errors.js';

/** A field that the server would refuse: emptied, or not a number. */
const INVALID_VALUES: LabelIssue = { code: 'invalid_values', blocking: true };

/**
 * The options of the label PDF: the layout, which presets save and apply, and the range of codes
 * of the prefix that `prefix` gives. A number field holds null when emptied and its text when it is
 * not a number (NumberInput), which the checks refuse like the server.
 */
export class LabelOptions {
    readonly #prefix: () => string;
    startNumber = $state(5);
    count = $state(25);
    layout = $state<LabelLayout>({
        pageFormat: 'A4',
        // The narrowest whole millimetre that prints a barcode: every generated code has
        // BARCODE_LENGTH characters, 145 modules of at least MIN_MODULE_WIDTH once padded.
        labelWidth: 56,
        labelHeight: 30,
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
    });

    constructor(prefix: () => string) {
        this.#prefix = prefix;
    }

    get prefix(): string {
        return this.#prefix();
    }

    /** The layout as the server reads it, or what it refuses in it. */
    #layout = $derived(labelLayoutSchema.safeParse(this.layout));

    /** What the server would refuse in the range of codes, which the prefix bounds. */
    #rangeErrors = $derived(
        rangeErrors(this.prefix, { startNumber: this.startNumber, count: this.count })
    );

    /**
     * What the server would refuse (blocking issues) or warn about in the layout alone, which a
     * preset saves, found by the code that it runs: the layout schema, then checkLabelLayout.
     */
    #layoutIssues: LabelIssue[] = $derived(
        this.#layout.success ? checkLabelLayout(this.#layout.data) : [INVALID_VALUES]
    );

    /** Those of the PDF: the layout's, and an invalid range of codes, listed once. */
    readonly issues: LabelIssue[] = $derived(
        Object.keys(this.#rangeErrors).length === 0 || !this.#layout.success
            ? this.#layoutIssues
            : [...this.#layoutIssues, INVALID_VALUES]
    );

    /** The message under each field that the server would refuse: which number it expects. */
    readonly fieldErrors: FieldErrors = $derived({
        ...this.#rangeErrors,
        ...(this.#layout.success ? {} : issueErrors(this.#layout.error.issues, labelLayoutSchema))
    });

    readonly printable = $derived(this.issues.every((issue) => !issue.blocking));

    /** Why the server would not save the layout as a preset: it refuses labels that cannot print. */
    readonly layoutErrors: LabelIssue[] = $derived(
        this.#layoutIssues.filter((issue) => issue.blocking)
    );

    readonly layoutPrintable = $derived(this.layoutErrors.length === 0);

    /** The body of POST /api/barcode/pdf-labels. */
    request(): z.input<typeof labelSheetSchema> & { prefix: string } {
        return {
            ...this.layout,
            startNumber: this.startNumber,
            count: this.count,
            prefix: this.prefix
        };
    }

    apply(preset: LabelPreset) {
        this.layout = {
            pageFormat: preset.pageFormat,
            labelWidth: preset.labelWidth,
            labelHeight: preset.labelHeight,
            marginTop: preset.marginTop,
            marginLeft: preset.marginLeft,
            marginBottom: preset.marginBottom,
            marginRight: preset.marginRight,
            // Nullable columns, which migration 0005 filled in every preset
            labelPadding: preset.labelPadding ?? preset.padding,
            horizontalSpacing: preset.horizontalSpacing ?? 2,
            verticalSpacing: preset.verticalSpacing ?? 2,
            codeType: preset.codeType,
            showCodeValue: preset.showCodeValue,
            showBorder: preset.showBorder
        };
    }
}
