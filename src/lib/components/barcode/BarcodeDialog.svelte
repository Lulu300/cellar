<script lang="ts">
    import QRCode from 'qrcode';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { code128Bars, Code128EncodingError, QUIET_ZONE_MODULES } from '#lib/shared/barcode.js';
    import { saveBlob } from '#lib/utils/download.js';

    /** The barcode and the QR code of a bottle's code, each to download. */
    let {
        open = $bindable(false),
        barcodeValue,
        onClose
    }: { open?: boolean; barcodeValue: string; onClose: () => void } = $props();

    // In SVG units: one per module, with the white of the labels on each side.
    const BAR_HEIGHT = 50;
    const TEXT_HEIGHT = 10;
    const BARCODE_HEIGHT = BAR_HEIGHT + TEXT_HEIGHT + 2 * 4;
    // Pixels per module of the downloaded SVG, as JsBarcode drew it; the page sizes it by CSS.
    const DOWNLOAD_SCALE = 3;

    /** The bars of the code, or null for a code that Code 128 cannot encode. */
    const barcode = $derived.by(() => {
        try {
            return code128Bars(barcodeValue);
        } catch (error) {
            if (error instanceof Code128EncodingError) return null;
            throw error;
        }
    });
    const barcodeWidth = $derived(barcode ? barcode.moduleCount + 2 * QUIET_ZONE_MODULES : 0);

    let barcodeSvg = $state<SVGSVGElement>();
    let qrCanvas = $state<HTMLCanvasElement>();

    // The canvas exists while the dialog is open: draw the code of the bottle shown.
    $effect(() => {
        if (!qrCanvas) return;
        // A failure leaves the canvas blank: the barcode below still shows the value.
        QRCode.toCanvas(qrCanvas, barcodeValue, { width: 300, margin: 2 }).catch(() => {});
    });

    function downloadBarcode() {
        if (!barcodeSvg) return;
        const svg = new XMLSerializer().serializeToString(barcodeSvg);
        saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `barcode-${barcodeValue}.svg`);
    }

    function downloadQRCode() {
        qrCanvas?.toBlob((blob) => {
            if (blob) saveBlob(blob, `qrcode-${barcodeValue}.png`);
        }, 'image/png');
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && onClose()}>
    <DialogContent class="max-w-2xl">
        <DialogHeader>
            <DialogTitle>{m['barcode.dialog_title']()}</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col items-center gap-6 py-4">
            <div class="flex flex-col items-center w-full">
                <h3 class="text-sm font-medium mb-2">{m['common.barcode']()}</h3>
                {#if barcode}
                    <svg
                        bind:this={barcodeSvg}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 {barcodeWidth} {BARCODE_HEIGHT}"
                        width={barcodeWidth * DOWNLOAD_SCALE}
                        height={BARCODE_HEIGHT * DOWNLOAD_SCALE}
                        class="w-full max-w-md h-32"
                        role="img"
                        aria-label={barcodeValue}
                    >
                        <rect width="100%" height="100%" fill="#ffffff" />
                        {#each barcode.bars as bar (bar.start)}
                            <rect
                                x={QUIET_ZONE_MODULES + bar.start}
                                y="4"
                                width={bar.width}
                                height={BAR_HEIGHT}
                                fill="#000000"
                            />
                        {/each}
                        <text
                            x={barcodeWidth / 2}
                            y={BAR_HEIGHT + TEXT_HEIGHT + 2}
                            text-anchor="middle"
                            font-family="monospace"
                            font-size={TEXT_HEIGHT}
                            fill="#000000">{barcodeValue}</text
                        >
                    </svg>
                    <Button variant="outline" size="sm" class="mt-2" onclick={downloadBarcode}>
                        {m['barcode.download_barcode']()}
                    </Button>
                {:else}
                    <p class="text-sm text-muted-foreground text-center">
                        {m['barcode.not_encodable']()}
                    </p>
                {/if}
            </div>

            <div class="flex flex-col items-center w-full">
                <h3 class="text-sm font-medium mb-2">{m['barcode.qr_code']()}</h3>
                <canvas bind:this={qrCanvas} width="300" height="300" class="max-w-full h-auto"
                ></canvas>
                <p class="text-xs mt-2 font-mono">{barcodeValue}</p>
                <Button variant="outline" size="sm" class="mt-2" onclick={downloadQRCode}>
                    {m['barcode.download_qr_code']()}
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
