<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        BarcodePrefixTooLongError,
        BarcodeRangeError,
        formatBarcode,
        maxBarcodeNumber
    } from '#lib/shared/barcode.js';
    import { formatNumber } from '#lib/utils/format.js';

    /** The code `start` of `prefix`, or the `count` codes from it, as the labels print them. */
    let { prefix, start, count = 1 }: { prefix: string; start: number; count?: number } = $props();

    /** The codes, or why there are none: said once for the whole range. */
    function text(): string {
        try {
            const first = formatBarcode(prefix, start);
            if (count <= 1) return first;
            return m['barcode.range_value']({
                first,
                last: formatBarcode(prefix, start + count - 1)
            });
        } catch (thrown) {
            if (thrown instanceof BarcodeRangeError) {
                return m['barcode.number_out_of_range']({
                    max: formatNumber(maxBarcodeNumber(prefix))
                });
            }
            // A prefix saved before prefixes were checked, to change.
            if (thrown instanceof BarcodePrefixTooLongError) {
                return m['errors.barcode_prefix_too_long']();
            }
            throw thrown;
        }
    }

    // An emptied number field holds null, and the sums made from it NaN.
    const shown = $derived(Number.isFinite(start) && Number.isFinite(count));
</script>

{#if shown}
    {text()}
{/if}
