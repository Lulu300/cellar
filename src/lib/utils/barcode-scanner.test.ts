import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBarcodeDetector, scannedValue } from './barcode-scanner';

type PrepareOptions = { overrides: { locateFile: (path: string, prefix: string) => string } };

const ponyfill = vi.hoisted(() => ({
    BarcodeDetector: class {
        constructor(readonly options: unknown) {}
    },
    prepareZXingModule: vi.fn<(options: PrepareOptions) => Promise<object>>(async () => ({})),
    purgeZXingModule: vi.fn()
}));
vi.mock('barcode-detector/ponyfill', () => ponyfill);

/** A browser's own BarcodeDetector that reads `formats`. */
function nativeDetector(formats: string[]) {
    return class {
        static getSupportedFormats = async () => formats;
        constructor(readonly options: unknown) {}
    };
}

describe('createBarcodeDetector', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("uses the browser's detector when it reads Code 128 and QR codes", async () => {
        // Like Chrome on macOS: no UPC-A
        const Native = nativeDetector(['aztec', 'code_128', 'ean_13', 'qr_code', 'upc_e']);
        vi.stubGlobal('BarcodeDetector', Native);

        const detector = await createBarcodeDetector();

        expect(detector).toBeInstanceOf(Native);
        expect(detector).toMatchObject({
            options: { formats: ['code_128', 'qr_code', 'ean_13', 'upc_e'] }
        });
        expect(ponyfill.prepareZXingModule).not.toHaveBeenCalled();
    });

    it.each([
        ['has no detector', undefined],
        ['reads no Code 128', nativeDetector(['qr_code'])]
    ])('loads zxing-wasm from the app when the browser %s', async (_, native) => {
        vi.stubGlobal('BarcodeDetector', native);

        const detector = await createBarcodeDetector();

        expect(detector).toBeInstanceOf(ponyfill.BarcodeDetector);
        expect(detector).toMatchObject({
            options: {
                formats: [
                    'code_128',
                    'qr_code',
                    'ean_13',
                    'ean_8',
                    'upc_a',
                    'upc_e',
                    'code_39',
                    'data_matrix'
                ]
            }
        });
        // Never the CDN that zxing-wasm uses by default: Cellar often runs without Internet
        const [[{ overrides }]] = ponyfill.prepareZXingModule.mock.calls;
        const wasmUrl = overrides.locateFile('zxing_reader.wasm', 'https://fastly.jsdelivr.net/');
        expect(wasmUrl).toMatch(/^\/.*zxing_reader\.wasm$/);
    });

    it('downloads the .wasm again on the next try when it failed', async () => {
        vi.stubGlobal('BarcodeDetector', undefined);
        ponyfill.prepareZXingModule.mockRejectedValueOnce(new Error('network down'));

        await expect(createBarcodeDetector()).rejects.toThrow('network down');
        expect(ponyfill.purgeZXingModule).toHaveBeenCalled();
    });
});

describe('scannedValue', () => {
    it('gives a UPC-A read as a 13-digit EAN-13 its 12 digits, as html5-qrcode did', () => {
        expect(scannedValue({ rawValue: '0123456789012', format: 'ean_13' })).toBe('123456789012');
        expect(scannedValue({ rawValue: '123456789012', format: 'upc_a' })).toBe('123456789012');
    });

    it.each([
        // One per zero-suppression rule: the last UPC-E digit tells which
        ['0036000007862', '03678602'],
        ['0012300000451', '01234531'],
        ['0012340000053', '01234543'],
        ['0012345000089', '01234589'],
        ['0112300000458', '11234538']
    ])('gives the UPC-E that zxing-wasm expands to %s its 8 digits', (rawValue, value) => {
        expect(scannedValue({ rawValue, format: 'upc_e' })).toBe(value);
        expect(scannedValue({ rawValue: value, format: 'upc_e' })).toBe(value);
    });

    it('keeps every other value as read', () => {
        expect(scannedValue({ rawValue: '4006381333931', format: 'ean_13' })).toBe('4006381333931');
        // A Code 128 that happens to look like a UPC-A read as EAN-13
        expect(scannedValue({ rawValue: '0123456789012', format: 'code_128' })).toBe(
            '0123456789012'
        );
        expect(scannedValue({ rawValue: 'BX00000042', format: 'code_128' })).toBe('BX00000042');
    });
});
