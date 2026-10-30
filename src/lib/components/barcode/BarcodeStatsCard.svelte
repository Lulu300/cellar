<script lang="ts">
    import { ChartColumn, Download } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import type { BarcodeSettingsDTO } from '#lib/shared/dto.js';
    import BarcodeRange from './BarcodeRange.svelte';
    import { downloadFile } from './api.js';

    /**
     * The bottles that have a barcode, and their export: those of the prefix with automatic
     * barcodes, every bottle with a barcode without them. `nextNumber` is the number of the next
     * automatic barcode.
     */
    let {
        settings,
        total,
        nextNumber = null
    }: { settings: BarcodeSettingsDTO; total: number; nextNumber?: number | null } = $props();

    let exporting = $state(false);

    async function exportBottles() {
        exporting = true;
        await downloadFile(
            () =>
                fetch(
                    settings.autoGeneration
                        ? '/api/barcode/export-all'
                        : '/api/barcode/export-manual'
                ),
            'bottles_with_barcodes.csv',
            {
                saved: () => m['toast.downloaded_bottles_with_barcodes']({ count: total }),
                refused: (error) => m['toast.failed_to_export_bottles']({ error }),
                failed: m['toast.error_exporting_bottles']()
            }
        );
        exporting = false;
    }
</script>

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <ChartColumn class="h-5 w-5" />
            {settings.autoGeneration ? m['barcode.statistics']() : m['barcode.manual_statistics']()}
        </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <div class="flex justify-between items-center">
            <span class="text-sm text-muted-foreground">
                {settings.autoGeneration
                    ? m['barcode.bottles_with_barcode']()
                    : m['barcode.bottles_with_manual_barcodes']()}
            </span>
            <Badge variant="secondary" class="text-lg px-3 py-1">{total}</Badge>
        </div>

        {#if settings.autoGeneration}
            <div class="flex justify-between items-center">
                <span class="text-sm text-muted-foreground">{m['barcode.next_barcode']()}</span>
                <Badge variant="outline" class="font-mono text-sm">
                    {#if nextNumber !== null}
                        <BarcodeRange prefix={settings.prefix} start={nextNumber} />
                    {/if}
                </Badge>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-sm text-muted-foreground">{m['barcode.barcode_prefix']()}</span>
                <Badge variant="outline" class="font-mono">
                    {settings.prefix || m['barcode.none']()}
                </Badge>
            </div>
        {/if}

        <div class="pt-4 border-t">
            <Button
                onclick={exportBottles}
                disabled={exporting || total === 0}
                variant={settings.autoGeneration ? 'outline' : 'default'}
                class="w-full"
            >
                {#if exporting}
                    {m['barcode.exporting']()}
                {:else}
                    <Download class="h-4 w-4 mr-2" />
                    {m['barcode.export_all_bottles']()} ({total})
                {/if}
            </Button>
        </div>
    </CardContent>
</Card>
