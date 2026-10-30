import { m } from '#lib/paraglide/messages.js';
import { issueErrors, type FieldErrors } from '#lib/components/forms/field-errors.js';
import { isPrefixTooLong, maxBarcodeNumber } from '#lib/shared/barcode.js';
import { labelRangeSchema, prefixRangeSchema } from '#lib/shared/schemas/label.js';
import { formatNumber } from '#lib/utils/format.js';

/**
 * The message under each field of a range of codes of `prefix` that the server would refuse. A
 * count that runs past the last number of the prefix says how many codes are left from the start:
 * its own bounds are not what stops it.
 */
export function rangeErrors(
    prefix: string,
    range: { startNumber: number; count: number }
): FieldErrors {
    // A prefix that an old version saved longer than 6 characters has no number to bound the
    // range with: the page asks to change it instead.
    const schema = isPrefixTooLong(prefix) ? labelRangeSchema : prefixRangeSchema(prefix);
    const checked = schema.safeParse(range);
    if (checked.success) return {};
    const errors = issueErrors(checked.error.issues, schema);
    // The refinement of the whole range: the count, valid alone, runs past the last number.
    if (checked.error.issues.some((issue) => issue.code === 'custom')) {
        errors.count = m['form_errors.whole_number_between']({
            min: formatNumber(1),
            max: formatNumber(maxBarcodeNumber(prefix) - range.startNumber + 1)
        });
    }
    return errors;
}
