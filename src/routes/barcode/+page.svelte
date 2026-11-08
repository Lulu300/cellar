<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Hash, QrCode } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import BarcodeRange from '#lib/components/barcode/BarcodeRange.svelte';
    import BarcodeStatsCard from '#lib/components/barcode/BarcodeStatsCard.svelte';
    import CsvRangeCard from '#lib/components/barcode/CsvRangeCard.svelte';
    import LabelPdfCard from '#lib/components/barcode/LabelPdfCard.svelte';
    import { LabelOptions } from '#lib/components/barcode/label-options.svelte.js';
    import { barcodePrefixError } from '#lib/components/barcode/prefix-error.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';

    let { data } = $props();

    const { barcodeSettings, barcodeStats, manualBarcodeStats, labelPresets } = $derived(data);

    /** Without automatic barcodes, the prefix of the codes to export, typed here and not saved. */
    let manualPrefix = $state('');
    const prefix = $derived(barcodeSettings.autoGeneration ? barcodeSettings.prefix : manualPrefix);
    // Says why the PDF and CSV buttons are greyed, next to each
    const prefixError = $derived(barcodePrefixError(prefix, barcodeSettings.autoGeneration));

    // Here rather than in the cards, which manual mode removes while the prefix is empty.
    const labelOptions = new LabelOptions(() => prefix);
    const csvRange = $state({ startNumber: 5, count: 25 });
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.barcode']())}</title>
</svelte:head>

<div class="flex items-center justify-between mb-8">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">{m['barcode.title']()}</h1>
        <p class="text-muted-foreground mt-2">{m['barcode.subtitle']()}</p>
    </div>
    <QrCode class="h-8 w-8 text-muted-foreground" />
</div>

{#if barcodeSettings.autoGeneration}
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <BarcodeStatsCard
            settings={barcodeSettings}
            total={barcodeStats.totalWithBarcode}
            nextNumber={barcodeStats.nextNumber}
        />
        <CsvRangeCard
            {prefix}
            {prefixError}
            bind:startNumber={csvRange.startNumber}
            bind:count={csvRange.count}
        />
        <LabelPdfCard presets={labelPresets} options={labelOptions} {prefixError} />
    </div>

    <Card>
        <CardHeader>
            <CardTitle>{m['barcode.export_options']()}</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="space-y-3 text-sm">
                <p>
                    <strong>{m['barcode.csv_range_export_title']()}</strong>
                    {m['barcode.csv_range_export']()}
                </p>
                <p>
                    <strong>{m['barcode.csv_full_export_title']()}</strong>
                    {m['barcode.csv_full_export']()}
                </p>
                <p>
                    <strong>{m['barcode.pdf_label_generation_title']()}</strong>
                    {m['barcode.pdf_label_generation']()}
                </p>
                <p class="text-muted-foreground">
                    {m['barcode.prefix_note']({
                        prefix: barcodeSettings.prefix || m['barcode.none']()
                    })}
                </p>
            </div>
        </CardContent>
    </Card>
{:else}
    <div class="space-y-6">
        <Card>
            <CardContent class="pt-6">
                <div class="text-center py-8">
                    <Hash class="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 class="text-lg font-semibold mb-2">{m['barcode.manual_mode']()}</h2>
                    <p class="text-muted-foreground mb-4">
                        {m['barcode.manual_mode_description']()}
                    </p>
                    <Button href="/admin" variant="outline">{m['barcode.go_to_admin']()}</Button>
                </div>
            </CardContent>
        </Card>

        <BarcodeStatsCard settings={barcodeSettings} total={manualBarcodeStats.totalWithBarcode} />

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Hash class="h-5 w-5" />
                    {m['barcode.manual_prefix_config']()}
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <p class="text-sm text-muted-foreground">
                    {m['barcode.manual_prefix_description']()}
                </p>
                <div class="space-y-2">
                    <Label for="manual-prefix">{m['barcode.barcode_prefix']()}</Label>
                    <Input
                        id="manual-prefix"
                        bind:value={manualPrefix}
                        placeholder={m['barcode.prefix_placeholder']()}
                        maxlength={6}
                        aria-invalid={!!prefixError}
                        class="font-mono"
                    />
                    {#if prefixError}
                        <p class="text-sm text-destructive">{prefixError}</p>
                    {:else if manualPrefix}
                        <p class="text-xs text-muted-foreground">
                            {m['barcode.preview']()}
                            <BarcodeRange {prefix} start={1} />
                        </p>
                    {/if}
                </div>
            </CardContent>
        </Card>

        {#if manualPrefix}
            <div class="grid gap-6 md:grid-cols-2">
                <CsvRangeCard
                    {prefix}
                    {prefixError}
                    bind:startNumber={csvRange.startNumber}
                    bind:count={csvRange.count}
                />
                <LabelPdfCard presets={labelPresets} options={labelOptions} {prefixError} />
            </div>
        {/if}

        <Card>
            <CardHeader>
                <CardTitle>{m['barcode.manual_mode_info']()}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="space-y-3 text-sm">
                    <p>
                        <strong>{m['barcode.manual_export_title']()}</strong>
                        {m['barcode.manual_export_description']()}
                    </p>
                    <p>
                        <strong>{m['barcode.manual_prefix_info']()}</strong>
                        {m['barcode.manual_prefix_info_description']()}
                    </p>
                    <p class="text-muted-foreground">
                        {m['barcode.enable_auto_generation']()}
                    </p>
                </div>
            </CardContent>
        </Card>
    </div>
{/if}
