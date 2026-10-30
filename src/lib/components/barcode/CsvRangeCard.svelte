<script lang="ts">
    import { Download } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import { Input } from '#lib/components/ui/input/index.js';
    import { formatBarcode } from '#lib/shared/barcode.js';
    import BarcodeRange from './BarcodeRange.svelte';
    import { downloadFile, sendJson } from './api.js';
    import { rangeErrors } from './range-errors.js';

    /**
     * The CSV of a range of codes of `prefix`, with the bottle of each code that one has. The
     * server reads the prefix only when automatic barcodes are off, and uses its own otherwise.
     * `prefixError` says what is wrong with the prefix, which then exports nothing. The range
     * belongs to the page, so that it outlives the card.
     */
    let {
        prefix,
        prefixError,
        startNumber = $bindable(),
        count = $bindable()
    }: { prefix: string; prefixError?: string; startNumber: number; count: number } = $props();
    let generating = $state(false);
    // The message of the prefix, which the button names for assistive technologies
    const prefixErrorId = $props.id();

    // What each field expects, under it, when the server would refuse it
    const fieldErrors = $derived(rangeErrors(prefix, { startNumber, count }));

    async function generateCsv() {
        generating = true;
        // Read now: the fields may change while the file comes.
        const range = { startNumber, count, prefix };
        await downloadFile(() => sendJson('POST', '/api/barcode/csv', range), 'barcodes.csv', {
            saved: () =>
                m['toast.downloaded_barcodes']({
                    count: range.count,
                    barcode: formatBarcode(prefix, range.startNumber)
                }),
            refused: (error) => m['toast.failed_to_generate_csv']({ error }),
            failed: m['toast.error_generating_csv']()
        });
        generating = false;
    }
</script>

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <Download class="h-5 w-5" />
            {m['barcode.generate_csv']()}
        </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <FormField
            label={m['barcode.starting_number']()}
            id="csv-start-number"
            error={fieldErrors.startNumber}
        >
            <Input
                id="csv-start-number"
                type="number"
                bind:value={startNumber}
                min="1"
                class="font-mono"
            />
            {#if !prefixError}
                <p class="text-xs text-muted-foreground">
                    {m['barcode.preview']()}
                    <BarcodeRange {prefix} start={startNumber} />
                </p>
            {/if}
        </FormField>

        <FormField
            label={m['barcode.number_of_barcodes']()}
            id="csv-count"
            error={fieldErrors.count}
        >
            <Input id="csv-count" type="number" bind:value={count} min="1" max="1000" />
            {#if !prefixError}
                <p class="text-xs text-muted-foreground">
                    {m['barcode.range']()}
                    <BarcodeRange {prefix} start={startNumber} {count} />
                </p>
            {/if}
        </FormField>

        {#if prefixError}
            <p id={prefixErrorId} class="text-sm text-destructive">{prefixError}</p>
        {/if}
        <Button
            onclick={generateCsv}
            disabled={generating || Object.keys(fieldErrors).length > 0 || !!prefixError}
            aria-describedby={prefixError ? prefixErrorId : undefined}
            class="w-full"
        >
            {#if generating}
                {m['barcode.generating']()}
            {:else}
                <Download class="h-4 w-4 mr-2" />
                {m['barcode.download_csv']()}
            {/if}
        </Button>
    </CardContent>
</Card>
