import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { code128Bars, code128ModuleWidth } from '#lib/shared/barcode.js';
import { codeHeight, codeValueSpace, labelGrid, PAGE_SIZES, TEXT_GAP } from '#lib/shared/labels.js';
import type { LabelSheet } from '#lib/shared/schemas/label.js';
import { labelPrefix, requestedBarcodeRange } from '#lib/server/features/barcode/service.js';
import { assertPrintable } from './service';

/** A PDF of the labels that `options` asks for. */
export function generateLabelsPdf(options: LabelSheet): { filename: string; pdf: Buffer } {
    const prefix = labelPrefix(options.prefix);
    const barcodes = requestedBarcodeRange(prefix, options.startNumber, options.count);
    assertPrintable(options);

    const pageSize = PAGE_SIZES[options.pageFormat];
    const { columns, rows } = labelGrid(options);
    const labelsPerPage = columns * rows;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pageSize.width, pageSize.height]
    });

    for (const [i, barcode] of barcodes.entries()) {
        if (i % labelsPerPage === 0 && i > 0) {
            pdf.addPage([pageSize.width, pageSize.height]);
        }
        const labelIndex = i % labelsPerPage;
        const x =
            options.marginLeft +
            (labelIndex % columns) * (options.labelWidth + options.horizontalSpacing);
        const y =
            options.marginTop +
            Math.floor(labelIndex / columns) * (options.labelHeight + options.verticalSpacing);
        addLabelToPDF(pdf, barcode, x, y, options);
    }

    const filename = `labels_${prefix}_${options.startNumber}_${options.count}_${Date.now()}.pdf`;
    return { filename, pdf: Buffer.from(pdf.output('arraybuffer')) };
}

function addLabelToPDF(pdf: jsPDF, barcode: string, x: number, y: number, options: LabelSheet) {
    const { labelWidth, labelHeight, labelPadding: padding } = options;
    const availableWidth = labelWidth - 2 * padding;
    const availableHeight = labelHeight - 2 * padding;
    const textSpace = codeValueSpace(options.showCodeValue);
    const height = codeHeight(options);
    // Centre the code and its value vertically
    const codeY = y + padding + (availableHeight - height - textSpace) / 2;

    if (options.showBorder) drawBorder(pdf, x, y, labelWidth, labelHeight, codeY, height);

    pdf.setFillColor(0, 0, 0);
    if (options.codeType === 'barcode') {
        // Vector bars, centred, at the module width that checkLabelLayout checked.
        const { bars, moduleCount } = code128Bars(barcode);
        const moduleWidth = code128ModuleWidth(moduleCount, labelWidth, padding);
        const barsX = x + (labelWidth - moduleCount * moduleWidth) / 2;
        for (const bar of bars) {
            pdf.rect(barsX + bar.start * moduleWidth, codeY, bar.width * moduleWidth, height, 'F');
        }
    } else {
        drawQrCode(pdf, barcode, x + padding + (availableWidth - height) / 2, codeY, height);
    }

    if (options.showCodeValue) {
        pdf.setFontSize(8);
        pdf.setTextColor(0);
        const textX = x + (labelWidth - pdf.getTextWidth(barcode)) / 2;
        // Below the code, +3 for the font baseline
        pdf.text(barcode, textX, codeY + height + TEXT_GAP + 3);
    }
}

/**
 * Draws the QR code of `data` as vector squares, `size` mm wide: one rectangle per run of dark
 * modules of a row, which keeps the PDF far smaller than an image of each code.
 */
function drawQrCode(pdf: jsPDF, data: string, x: number, y: number, size: number) {
    const { modules } = QRCode.create(data, { errorCorrectionLevel: 'M' });
    const moduleSize = size / modules.size;
    for (let row = 0; row < modules.size; row++) {
        let column = 0;
        while (column < modules.size) {
            if (!modules.get(row, column)) {
                column++;
                continue;
            }
            const start = column;
            while (column < modules.size && modules.get(row, column)) column++;
            pdf.rect(
                x + start * moduleSize,
                y + row * moduleSize,
                (column - start) * moduleSize,
                moduleSize,
                'F'
            );
        }
    }
}

/**
 * Outlines the label in light gray to preview the cut. The sides stop beside the code: a scanner
 * reading a row of the code must not meet a dark line before the bars.
 */
function drawBorder(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    codeY: number,
    codeSize: number
) {
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.1);
    pdf.line(x, y, x + width, y);
    pdf.line(x, y + height, x + width, y + height);
    for (const sideX of [x, x + width]) {
        pdf.line(sideX, y, sideX, codeY);
        pdf.line(sideX, codeY + codeSize, sideX, y + height);
    }
}
