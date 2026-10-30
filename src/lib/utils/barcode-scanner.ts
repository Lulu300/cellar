import type { BarcodeDetector, BarcodeFormat, DetectedBarcode } from 'barcode-detector/ponyfill';
// Aliased in vite.config.ts to the copy of zxing-wasm that barcode-detector runs
import zxingReaderWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

/** What Cellar prints on its labels: Code 128 barcodes and QR codes. */
const PRINTED_FORMATS: BarcodeFormat[] = ['code_128', 'qr_code'];
/**
 * Also read: a bottle's retail code (EAN, UPC), which can be its manual barcode, and the formats
 * that label software may use for codes from the CSV export. Not ITF, Codabar or DataBar, which a
 * continuous scan misreads in arbitrary stripes.
 */
const FORMATS: BarcodeFormat[] = [
    ...PRINTED_FORMATS,
    'ean_13',
    'ean_8',
    'upc_a',
    'upc_e',
    'code_39',
    'data_matrix'
];

// zxing-wasm downloads its .wasm from a CDN by default. Cellar often runs on a network without
// Internet, so the app serves it. A constant, so that zxing-wasm reuses the module it compiled.
const ZXING_OVERRIDES = {
    locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? zxingReaderWasm : prefix + path
};

/**
 * The browser's own BarcodeDetector when it reads every format Cellar prints, asked only for the
 * formats it reports supporting. Otherwise the zxing-wasm one from barcode-detector, loaded on
 * first use.
 */
export async function createBarcodeDetector(): Promise<BarcodeDetector> {
    const native = (globalThis as { BarcodeDetector?: typeof BarcodeDetector }).BarcodeDetector;
    if (native) {
        const supported = await native.getSupportedFormats();
        if (PRINTED_FORMATS.every((format) => supported.includes(format))) {
            return new native({ formats: FORMATS.filter((format) => supported.includes(format)) });
        }
    }

    const ponyfill = await import('barcode-detector/ponyfill');
    try {
        // Fetches and compiles the .wasm now, so that a failure shows when the scanner starts
        await ponyfill.prepareZXingModule({ overrides: ZXING_OVERRIDES, fireImmediately: true });
    } catch (error) {
        // zxing-wasm keeps the failed module: forget it, so that a retry downloads it again
        ponyfill.purgeZXingModule();
        throw error;
    }
    return new ponyfill.BarcodeDetector({ formats: FORMATS });
}

/**
 * The code's value as html5-qrcode, the previous scanner, gave it, so that it matches the codes
 * already stored by scanning: 12 digits for a UPC-A and 8 for a UPC-E. The detectors give a UPC-A
 * as a 13-digit EAN-13 starting with 0, and zxing-wasm expands a UPC-E to that form too.
 */
export function scannedValue({ rawValue, format }: Pick<DetectedBarcode, 'rawValue' | 'format'>) {
    if (!/^0\d{12}$/.test(rawValue)) return rawValue;
    if (format === 'ean_13') return rawValue.slice(1);
    if (format === 'upc_e') return upcE(rawValue.slice(1)) ?? rawValue.slice(1);
    return rawValue;
}

/** The 8-digit UPC-E that GS1 zero suppression makes of a 12-digit UPC-A, if any. */
function upcE(upcA: string): string | undefined {
    const system = upcA[0];
    const maker = upcA.slice(1, 6);
    const item = upcA.slice(6, 11);
    let digits: string | undefined;
    if (maker.endsWith('00') && '012'.includes(maker[2]) && item.startsWith('00')) {
        digits = maker.slice(0, 2) + item.slice(2) + maker[2];
    } else if (maker.endsWith('00') && item.startsWith('000')) {
        digits = maker.slice(0, 3) + item.slice(3) + '3';
    } else if (maker.endsWith('0') && item.startsWith('0000')) {
        digits = maker.slice(0, 4) + item[4] + '4';
    } else if (item.startsWith('0000') && item[4] >= '5') {
        digits = maker + item[4];
    }
    return (system === '0' || system === '1') && digits ? system + digits + upcA[11] : undefined;
}

/**
 * The part of a video frame that the scanner reads, in pixels: a band across the middle, shaped
 * for a barcode and tall enough for a QR code. Codes elsewhere in the picture are ignored.
 */
export function readingArea(width: number, height: number) {
    const areaWidth = Math.round(width * 0.8);
    const areaHeight = Math.round(Math.min(areaWidth / 2, height * 0.8));
    return {
        x: Math.round((width - areaWidth) / 2),
        y: Math.round((height - areaHeight) / 2),
        width: areaWidth,
        height: areaHeight
    };
}
