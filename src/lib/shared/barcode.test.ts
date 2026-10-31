import { describe, expect, it } from 'vitest';
import {
    BarcodePrefixTooLongError,
    BarcodeRangeError,
    Code128EncodingError,
    code128Bars,
    code128ModuleWidth,
    findBarcodeMatches,
    findSameBarcode,
    formatBarcode,
    formatBarcodeRange,
    generateCODE128Pattern,
    isValidBarcodePrefix,
    searchBarcode
} from './barcode';

describe('formatBarcode', () => {
    it('pads the number with zeros to 10 characters after the prefix', () => {
        expect(formatBarcode('WINE', 42)).toBe('WINE000042');
        expect(formatBarcode('', 7)).toBe('0000000007');
        expect(formatBarcode('CELLAR', 9999)).toBe('CELLAR9999');
    });

    it('refuses a prefix longer than 6 characters', () => {
        expect(() => formatBarcode('TOOLONG', 1)).toThrow(BarcodePrefixTooLongError);
    });

    // Cutting CELLAR10000 down to CELLAR0000 would repeat an earlier code.
    it('refuses a number too long for the prefix instead of truncating it', () => {
        expect(() => formatBarcode('CELLAR', 10_000)).toThrow(BarcodeRangeError);
        expect(() => formatBarcode('', 10_000_000_000)).toThrow(BarcodeRangeError);
    });

    // 0 is never given, and the API refuses a start number of 0 with the same bounds.
    it('says that the numbers start at 1', () => {
        expect(() => formatBarcode('CELLAR', 10_000)).toThrow(
            'with prefix "CELLAR", numbers go from 1 to 9999'
        );
    });

    it.each([-1, 1.5, Number.NaN])('refuses the number %j', (number) => {
        expect(() => formatBarcode('WINE', number)).toThrow(BarcodeRangeError);
    });
});

describe('formatBarcodeRange', () => {
    it('lists count consecutive codes from start', () => {
        expect(formatBarcodeRange('CV', 9, 3)).toEqual(['CV00000009', 'CV00000010', 'CV00000011']);
    });

    it('refuses a range that ends past the last number of the prefix', () => {
        expect(() => formatBarcodeRange('CELLAR', 9998, 3)).toThrow(BarcodeRangeError);
    });
});

describe('isValidBarcodePrefix', () => {
    it.each(['', 'WINE', 'cave', 'A-1', 'ABCDEF'])('accepts %j', (prefix) => {
        expect(isValidBarcodePrefix(prefix)).toBe(true);
    });

    it.each(['ABCDEFG', '../x', 'A B', 'A_B', 'É', 'A"', 42, null])('refuses %j', (prefix) => {
        expect(isValidBarcodePrefix(prefix)).toBe(false);
    });
});

describe('generateCODE128Pattern', () => {
    // Start B, data, checksum and stop, as JsBarcode 3.12.3 (CODE128B) encodes them.
    it.each([
        [
            'CV00000001',
            '1101001000010001000110111010110001001110110010011101100100111011001001110110010011101100100111011001001110110010011100110111000110101100011101011'
        ],
        [
            'wn-A000001',
            '1101001000011110010100110000101001001101110010100011000100111011001001110110010011101100100111011001001110110010011100110101100111001100011101011'
        ]
    ])('encodes %s like a reference encoder', (code, pattern) => {
        expect(generateCODE128Pattern(code)).toBe(pattern);
    });

    // Bar and space widths of each value, from the Code 128 specification (ISO/IEC 15417):
    // 0-102 data, 103-105 start A, B and C, then the stop pattern.
    const SPEC_WIDTHS = [
        '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212',
        '112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131',
        '311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321',
        '112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121',
        '313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111',
        '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114',
        '122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212',
        '124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113',
        '114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'
    ]
        .join(' ')
        .split(' ');
    const specSymbol = (value: number) =>
        [...SPEC_WIDTHS[value]].map((width, i) => (i % 2 ? '0' : '1').repeat(+width)).join('');

    // Two characters reach every data value, in both positions, and every checksum value.
    it('uses the symbol of the specification for every value', () => {
        const characters = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
        const wrong: string[] = [];
        for (const first of characters) {
            for (const second of characters) {
                const values = [first, second].map((char) => char.charCodeAt(0) - 32);
                const checksum = (104 + values[0] + 2 * values[1]) % 103;
                const expected = [104, ...values, checksum, 106].map(specSymbol).join('');
                if (generateCODE128Pattern(first + second) !== expected) wrong.push(first + second);
            }
        }
        expect(wrong).toEqual([]);
    });

    it.each(['CÉ00000001', 'CV\n0000001', 'CV\u007f'])(
        'refuses %j instead of encoding it',
        (code) => {
            expect(() => generateCODE128Pattern(code)).toThrow(Code128EncodingError);
        }
    );
});

describe('code128ModuleWidth', () => {
    const moduleCount = generateCODE128Pattern('CV00000001').length;
    const whitePerSide = (labelWidth: number, padding: number) =>
        (labelWidth - moduleCount * code128ModuleWidth(moduleCount, labelWidth, padding)) / 2;

    // A label stuck on a dark bottle has no white around it but its own.
    it.each([
        [101.6, 1],
        [102, 2],
        [70, 2],
        [100, 3]
    ])(
        'leaves 10 modules of white on each side of a %s mm label with %s mm padding',
        (width, padding) => {
            const moduleWidth = code128ModuleWidth(moduleCount, width, padding);
            expect(whitePerSide(width, padding) / moduleWidth).toBeGreaterThanOrEqual(10 - 1e-9);
        }
    );

    it('keeps the padding and 2 mm of white when they are wider than 10 modules', () => {
        expect(whitePerSide(80, 3)).toBeCloseTo(5);
    });

    // A Brother DK-11204 label: 10 modules on each side would need modules under 0.33 mm.
    it('keeps the narrowest module when 10 modules of white would make them too narrow', () => {
        expect(code128ModuleWidth(moduleCount, 54, 1)).toBe(0.33);
        expect(whitePerSide(54, 1)).toBeGreaterThanOrEqual(1 + 2);
    });
});

describe('code128Bars', () => {
    it('gives each run of bar modules of the pattern, left to right', () => {
        const pattern = generateCODE128Pattern('CV00000001');
        const { bars, moduleCount } = code128Bars('CV00000001');

        expect(moduleCount).toBe(pattern.length);
        const redrawn = Array<string>(moduleCount).fill('0');
        for (const bar of bars) redrawn.fill('1', bar.start, bar.start + bar.width);
        expect(redrawn.join('')).toBe(pattern);
        expect(
            bars.every((bar, i) => i === 0 || bar.start > bars[i - 1].start + bars[i - 1].width)
        ).toBe(true);
    });
});

describe('findBarcodeMatches', () => {
    const coded = (...barcodes: string[]) =>
        barcodes.map((barcode, i) => ({ id: `b${i}`, barcode }));

    it('finds the one bottle with the code as typed when another differs by its case only', () => {
        const bottles = coded('CV00000001', 'cv00000001');

        expect(findBarcodeMatches(bottles, 'CV00000001')).toEqual([bottles[0]]);
        expect(findBarcodeMatches(bottles, 'cv00000001')).toEqual([bottles[1]]);
    });

    it('then finds the code in other capitals, then the codes that end with it', () => {
        const bottles = coded('CV00000001', 'XX00000012', 'CV00000012');

        expect(findBarcodeMatches(bottles, 'cv00000001')).toEqual([bottles[0]]);
        expect(findBarcodeMatches(bottles, '012')).toEqual([bottles[1], bottles[2]]);
        expect(findBarcodeMatches(bottles, 'Cv00000003')).toEqual([]);
    });
});

describe('findSameBarcode', () => {
    it('skips the bottles without a barcode', () => {
        const bottles = [
            { id: 'b0', barcode: null },
            { id: 'b1', barcode: 'CV00000001' }
        ];

        expect(findSameBarcode(bottles, 'cv00000001')).toEqual([bottles[1]]);
    });
});

describe('searchBarcode', () => {
    const coded = (...barcodes: string[]) =>
        barcodes.map((barcode, i) => ({ id: `b${i}`, barcode }));

    it('finds the code as typed, then in other capitals, then the codes that contain it', () => {
        const bottles = coded('CV0001', 'CV00012', 'XCV0001Z', 'cv0001');

        expect(searchBarcode(bottles, 'CV0001')).toEqual([bottles[0]]);
        expect(searchBarcode(bottles, 'Cv00012')).toEqual([bottles[1]]);
        expect(searchBarcode(bottles, 'V000')).toEqual(bottles);
        expect(searchBarcode(bottles, 'nothing')).toEqual([]);
    });
});
