import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { LabelIssue } from '#lib/shared/labels.js';

/** A size in mm, in the language of the interface. */
const mm = (value: number, digits: number) =>
    new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits }).format(value);

/** What an issue of a label layout means for the user, with its sizes. */
export function labelIssueMessage({ code, values }: LabelIssue): string {
    const { actual = 0, limit = 0 } = values ?? {};
    switch (code) {
        case 'invalid_values':
            return m['errors.invalid_body']();
        case 'labels_do_not_fit':
            return m['errors.labels_do_not_fit']();
        case 'module_width_below_minimum':
            return m['barcode.module_width_below_minimum']({
                width: mm(actual, 3),
                min: mm(limit, 2)
            });
        case 'module_width_below_recommended':
            return m['barcode.module_width_below_recommended']({
                width: mm(actual, 3),
                recommended: mm(limit, 2)
            });
        case 'height_below_minimum':
            return m['barcode.height_below_minimum']({ height: mm(actual, 1), min: mm(limit, 1) });
        case 'height_below_recommended':
            return m['barcode.height_below_recommended']({
                height: mm(actual, 1),
                recommended: mm(limit, 1)
            });
        case 'qr_size_below_minimum':
            return m['barcode.qr_size_below_minimum']({
                size: mm(actual, 1),
                min: mm(limit, 1)
            });
        case 'qr_size_below_recommended':
            return m['barcode.qr_size_below_recommended']({
                size: mm(actual, 1),
                recommended: mm(limit, 1)
            });
        case 'qr_label_not_square':
            return m['barcode.qr_label_not_square']();
    }
}
