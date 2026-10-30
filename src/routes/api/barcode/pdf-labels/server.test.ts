import QRCode from 'qrcode';
import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { LabelOptions } from '#lib/components/barcode/label-options.svelte.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { generateCODE128Pattern } from '#lib/shared/barcode.js';
import type { LabelLayout } from '#lib/shared/schemas/label.js';
import { fakeEvent } from '../../../../test/event';
import { POST as exportCsv } from '../csv/+server';
import { POST } from './+server';

const labelOptions = {
    pageFormat: 'A4',
    labelWidth: 80,
    labelHeight: 30,
    marginTop: 10,
    marginLeft: 10,
    marginBottom: 10,
    marginRight: 10
};

const postLabels = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/barcode/pdf-labels',
            routeId: '/api/barcode/pdf-labels',
            body
        })
    );

const labelsPdf = (body: object) => postLabels({ ...labelOptions, ...body });

/** The filled rectangles of a one-label PDF, left to right, in pt (y grows upwards). */
function drawnBars(pdf: string) {
    // jsPDF writes uncompressed content: "x y width height re" then "f" for each filled rectangle.
    return [...pdf.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (-?[\d.]+) re\nf/g)]
        .map((match) => {
            const [x, y, width, height] = match.slice(1).map(Number);
            return { x, width, low: Math.min(y, y + height), high: Math.max(y, y + height) };
        })
        .sort((a, b) => a.x - b.x);
}

/** The modules (1 for a bar) that `bars` draw, and the width of one module in pt. */
function drawnModules(bars: ReturnType<typeof drawnBars>, moduleCount: number) {
    const start = bars[0].x;
    const last = bars[bars.length - 1];
    const moduleWidth = (last.x + last.width - start) / moduleCount;
    const modules = Array<string>(moduleCount).fill('0');
    for (const bar of bars) {
        const first = Math.round((bar.x - start) / moduleWidth);
        modules.fill('1', first, first + Math.round(bar.width / moduleWidth));
    }
    return { modules: modules.join(''), moduleWidth };
}

const pt = (mm: number) => (mm * 72) / 25.4;

/** The stroked lines and rectangles of a PDF, with their vertical extent in pt. */
function strokes(pdf: string) {
    const rectangles = [...pdf.matchAll(/[\d.]+ ([\d.]+) [\d.]+ (-?[\d.]+) re\nS\n/g)].map(
        (match) => [Number(match[1]), Number(match[1]) + Number(match[2])]
    );
    const lines = [...pdf.matchAll(/[\d.]+ ([\d.]+) m\n[\d.]+ ([\d.]+) l\nS\n/g)].map((match) => [
        Number(match[1]),
        Number(match[2])
    ]);
    return [...rectangles, ...lines].map(([a, b]) => ({
        low: Math.min(a, b),
        high: Math.max(a, b)
    }));
}

const rangeCsv = (body: object) =>
    exportCsv(
        fakeEvent<Parameters<typeof exportCsv>[0]>({
            method: 'POST',
            path: '/api/barcode/csv',
            routeId: '/api/barcode/csv',
            body
        })
    );

describe('POST /api/barcode/pdf-labels', () => {
    beforeAll(async () => {
        setAppSetting('barcode_auto_generation', 'true');
        setAppSetting('barcode_prefix', 'CV');
    });

    it('prints the same codes as the CSV of the same range', async () => {
        const range = { startNumber: 98, count: 4 };

        const response = await labelsPdf(range);
        expect(response.headers.get('content-type')).toBe('application/pdf');
        const pdf = await response.text();
        const csv = await (await rangeCsv(range)).text();

        // jsPDF writes uncompressed text: each label's code is a "(code) Tj" operator.
        const printed = [...pdf.matchAll(/\((\w+)\) Tj/g)].map((match) => match[1]);
        const listed = csv
            .trim()
            .split('\n')
            .slice(1)
            .map((row) => row.split(',')[0].replaceAll('"', ''));
        expect(printed).toEqual(['CV00000098', 'CV00000099', 'CV00000100', 'CV00000101']);
        expect(listed).toEqual(printed);
    });

    it('draws the bars of the Code 128 pattern of the code', async () => {
        const response = await labelsPdf({ startNumber: 42, count: 1 });

        const pattern = generateCODE128Pattern('CV00000042');
        const bars = drawnBars(await response.text());
        const { modules, moduleWidth } = drawnModules(bars, pattern.length);
        expect(modules).toBe(pattern);

        // The label spans 10 to 90 mm: at least 10 modules of white on each side of the bars.
        const last = bars[bars.length - 1];
        expect((bars[0].x - pt(10)) / moduleWidth).toBeGreaterThanOrEqual(9.99);
        expect((pt(90) - last.x - last.width) / moduleWidth).toBeGreaterThanOrEqual(9.99);
    });

    it('keeps the preview border off the rows of the bars', async () => {
        const response = await labelsPdf({ startNumber: 7, count: 1, showBorder: true });

        const pdf = await response.text();
        const [rows] = drawnBars(pdf);
        const border = strokes(pdf);
        // A scanner reading any row of the bars meets no border line before them
        const tolerance = 0.01;
        expect(
            border.filter(
                (line) => line.high > rows.low + tolerance && line.low < rows.high - tolerance
            )
        ).toEqual([]);
        // The sides are still drawn, above and below the bars
        const sides = border.filter((line) => line.high > line.low);
        expect(sides).toHaveLength(4);
        expect(sides.some((line) => line.low >= rows.high - tolerance)).toBe(true);
        expect(sides.some((line) => line.high <= rows.low + tolerance)).toBe(true);
    });

    it.each([
        ['an unknown page format', { pageFormat: 'A5' }],
        ['a negative margin', { marginLeft: -1 }],
        ['a missing margin', { marginTop: undefined }],
        ['a margin sent as text', { marginBottom: '10' }],
        ['a zero label width', { labelWidth: 0 }],
        ['a negative spacing', { horizontalSpacing: -2 }],
        ['an emptied padding field', { labelPadding: null }],
        ['an unknown code type', { codeType: 'datamatrix' }],
        ['a count above 1000', { count: 1001 }]
    ])('answers 422 to %s', async (_, invalid) => {
        const response = await labelsPdf({
            startNumber: 1,
            count: 1,
            codeType: 'qrcode',
            ...invalid
        });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_body');
    });

    it.each([
        ['a barcode label too short for its bars', { labelWidth: 50, labelHeight: 8 }],
        ['a padding that fills a QR code label', { codeType: 'qrcode', labelPadding: 14 }],
        ['a QR code label too short for the code value', { codeType: 'qrcode', labelHeight: 12 }]
    ])('answers 422 label_too_small, with the issues, to %s', async (_, small) => {
        const response = await labelsPdf({ startNumber: 1, count: 1, labelWidth: 30, ...small });

        expect(response.status).toBe(422);
        const { error } = await response.json();
        expect(error.code).toBe('label_too_small');
        expect(error.details.issues).toContainEqual(
            expect.objectContaining({
                code: expect.stringMatching(/below_minimum$/),
                blocking: true
            })
        );
    });

    it('answers 422 labels_do_not_fit to labels larger than the page', async () => {
        const response = await labelsPdf({ startNumber: 1, count: 1, labelWidth: 300 });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('labels_do_not_fit');
    });

    it('answers 400 to a body that is not JSON', async () => {
        expect((await postLabels('not json')).status).toBe(400);
    });

    it('reports a code that Code 128 cannot encode instead of printing a wrong barcode', async () => {
        // A prefix saved before prefixes were validated.
        setAppSetting('barcode_prefix', 'CÉ');
        try {
            const response = await labelsPdf({ startNumber: 1, count: 1 });

            expect(response.status).toBe(409);
            expect((await response.json()).error).toMatchObject({
                code: 'barcode_not_encodable',
                message: expect.stringMatching(/Code 128 cannot encode "CÉ00000001"/)
            });
        } finally {
            setAppSetting('barcode_prefix', 'CV');
        }
    });

    it('answers 409 barcode_prefix_too_long to a saved prefix of 7 characters or more', async () => {
        // A prefix saved before prefixes were validated.
        setAppSetting('barcode_prefix', 'OLDWINES');
        try {
            const response = await labelsPdf({ startNumber: 1, count: 1 });

            expect(response.status).toBe(409);
            expect((await response.json()).error.code).toBe('barcode_prefix_too_long');
        } finally {
            setAppSetting('barcode_prefix', 'CV');
        }
    });

    it('refuses a range past the last number of the prefix', async () => {
        const response = await labelsPdf({ startNumber: 99_999_999, count: 2 });

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'barcode_out_of_range',
            details: { min: 1, max: 99999999 }
        });
    });
});

describe('the label checks of the barcode page', () => {
    beforeAll(() => {
        setAppSetting('barcode_auto_generation', 'true');
        setAppSetting('barcode_prefix', 'CV');
    });

    const dk11204 = { labelWidth: 54, labelHeight: 17, labelPadding: 1, marginTop: 0 };

    // The fields as the form holds them: an emptied number field holds null.
    it.each<[string, Partial<LabelLayout>, { startNumber?: unknown; count?: unknown }?]>([
        ['the default form', {}],
        ['labels too narrow for the bars', { labelWidth: 50 }],
        ['a large barcode label', { labelWidth: 90 }],
        ['a label under the recommended width only', { labelWidth: 82 }],
        ['the narrowest preset', dk11204],
        ['bars lower than 10 mm', { ...dk11204, labelHeight: 16 }],
        ['labels larger than the page', { labelWidth: 300 }],
        ['margins that leave no room', { labelWidth: 90, marginLeft: 100, marginRight: 100 }],
        ['a square QR code label', { codeType: 'qrcode', labelWidth: 30 }],
        [
            'a QR code just above the recommended size',
            { codeType: 'qrcode', labelWidth: 22, labelHeight: 22 }
        ],
        [
            'a QR code too small under its value',
            { codeType: 'qrcode', labelWidth: 18, labelHeight: 18 }
        ],
        ['an emptied width', { labelWidth: null as unknown as number }],
        ['a negative margin', { labelWidth: 90, marginTop: -1 }],
        ['an emptied count', { labelWidth: 90 }, { count: null }],
        ['a count above 1000', { labelWidth: 90 }, { count: 1001 }],
        ['a start number of 0', { labelWidth: 90 }, { startNumber: 0 }],
        // CV leaves 8 digits: numbers go up to 99,999,999.
        ['the last numbers of the prefix', { labelWidth: 90 }, { startNumber: 99_999_975 }],
        ['a start past the last number', { labelWidth: 90 }, { startNumber: 100_000_000 }],
        ['a range that runs past the last number', { labelWidth: 90 }, { startNumber: 99_999_976 }]
    ])('agree with the server on %s', async (_, layout, range = {}) => {
        const options = new LabelOptions(() => 'CV');
        Object.assign(options.layout, layout);
        Object.assign(options, range);

        const response = await postLabels(options.request());

        expect(response.ok).toBe(options.printable);
        if (!response.ok) expect(response.status).toBe(422);
    });

    it('accepts some layouts and refuses others', () => {
        const options = new LabelOptions(() => 'CV');
        options.layout.labelWidth = 50;
        expect(options.printable).toBe(false);
        options.layout.labelWidth = 90;
        expect(options.printable).toBe(true);
    });

    // A first visit to the barcode page must print, whatever the prefix: every generated code has
    // the same length, and the longest prefix leaves the fewest digits.
    it('prints the default form with the longest prefix', async () => {
        setAppSetting('barcode_prefix', 'ABCDEF');
        onTestFinished(() => {
            setAppSetting('barcode_prefix', 'CV');
        });
        const options = new LabelOptions(() => 'ABCDEF');

        const response = await postLabels(options.request());

        expect(options.issues.filter((issue) => issue.blocking)).toEqual([]);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('(ABCDEF0005)');
    });
});

describe('QR code labels', () => {
    beforeAll(() => {
        setAppSetting('barcode_auto_generation', 'true');
        setAppSetting('barcode_prefix', 'CV');
    });

    it('draws each QR code as vector squares, not as an image', async () => {
        const response = await labelsPdf({
            startNumber: 5,
            count: 1,
            codeType: 'qrcode',
            labelWidth: 30,
            labelHeight: 30,
            showCodeValue: false
        });

        const pdf = await response.text();
        expect(pdf).not.toMatch(/\/Subtype \/Image/);
        // The filled rectangles, row by row, redraw the modules of the code.
        const { modules } = QRCode.create('CV00000005', { errorCorrectionLevel: 'M' });
        const squares = drawnBars(pdf);
        const moduleSize = Math.min(...squares.map((square) => square.high - square.low));
        const left = Math.min(...squares.map((square) => square.x));
        const top = Math.max(...squares.map((square) => square.high));
        const drawn = Array.from({ length: modules.size }, () => Array(modules.size).fill(0));
        for (const square of squares) {
            const row = Math.round((top - square.high) / moduleSize);
            const first = Math.round((square.x - left) / moduleSize);
            const width = Math.round(square.width / moduleSize);
            drawn[row].fill(1, first, first + width);
        }
        expect(drawn.flat().join('')).toBe(Array.from(modules.data).join(''));
    });
});
