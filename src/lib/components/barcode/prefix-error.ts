import { m } from '#lib/paraglide/messages.js';
import { isPrefixTooLong, isValidBarcodePrefix } from '#lib/shared/barcode.js';

/**
 * Why `prefix` gives no code, which greys the PDF and CSV buttons of the barcode page, or undefined.
 * With automatic barcodes, the server uses the saved prefix, which only fails when an old version
 * saved it longer than 6 characters; without, it refuses a typed prefix that it would not save.
 */
export function barcodePrefixError(prefix: string, automatic: boolean): string | undefined {
    if (automatic)
        return isPrefixTooLong(prefix) ? m['errors.barcode_prefix_too_long']() : undefined;
    return isValidBarcodePrefix(prefix) ? undefined : m['errors.invalid_barcode_prefix']();
}
