import type { Tx } from '#lib/server/db/connection.js';
import { wineBottles } from '#lib/server/db/schema.js';
import {
    getBarcodeSettings,
    setLastBarcodeNumber,
    type BarcodeSettings
} from '#lib/server/features/barcode/repository.js';
import { getNextBarcodeNumber } from '#lib/server/features/barcode/service.js';
import type { ImportedRow } from '#lib/server/features/shared/imported-rows.js';
import type { RowProblem, SkipReason } from './pipeline';
import { caseLoads, type CaseLoad } from '#lib/server/features/storage/repository.js';
import { bottleSchema } from '#lib/shared/schemas/bottle.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { formatBarcode, storedBarcode } from '#lib/shared/barcode.js';
import type { CsvRecord } from './parse';

/** A bottle without a barcode is recognised by all its other columns. */
const SAME_BOTTLE_COLUMNS = Object.keys(bottleSchema.shape).filter(
    (column) => column !== 'barcode'
);

function sameBottleKey(bottle: ImportedRow): string {
    return JSON.stringify(
        SAME_BOTTLE_COLUMNS.map((column) => {
            const value = bottle[column];
            if (value instanceof Date) return value.getTime();
            return typeof value === 'string' ? value.trim() : (value ?? null);
        })
    );
}

const isInCellar = (bottle: ImportedRow) =>
    bottle.availability === BottleAvailability.AVAILABLE && bottle.storageCaseId != null;

/**
 * The rules of a bottle file, with what they need of the cellar, read once: the barcodes taken,
 * the bottles without one, the room left in each case, the next barcode number.
 */
export class BottleImport {
    private barcodes: Set<string>;
    /** The barcodes that the rows of the file give, which a generated barcode must not take. */
    private fileBarcodes: Set<unknown>;
    /** How many bottles of the cellar without a barcode are alike in every other column. */
    private alike = new Map<string, number>();
    private loads: Map<string, CaseLoad>;
    private settings: BarcodeSettings;
    /** All the bottles get new barcodes: the user chose it, with automatic barcodes on. */
    private newBarcodes: boolean;
    private nextNumber: number | undefined;

    constructor(
        private tx: Tx,
        caseIds: string[],
        records: CsvRecord[],
        overrideAllBarcodes: boolean
    ) {
        const bottles = tx.select().from(wineBottles).all();
        this.barcodes = new Set(bottles.flatMap(({ barcode }) => (barcode ? [barcode] : [])));
        this.fileBarcodes = new Set(records.map((record) => storedBarcode(record.barcode)));
        // A bottle with a barcode is only ever recognised by it: a new bottle alike, which the
        // file gives without one, must not be taken for it.
        for (const bottle of bottles) {
            if (bottle.barcode) continue;
            const key = sameBottleKey(bottle);
            this.alike.set(key, (this.alike.get(key) ?? 0) + 1);
        }
        this.loads = new Map(caseLoads(caseIds, tx).map((load) => [load.id, load]));
        this.settings = getBarcodeSettings(tx);
        this.newBarcodes = overrideAllBarcodes && this.settings.autoGeneration;
    }

    /**
     * Why `bottle` is already in the cellar, if it is: its barcode, or, without one, a bottle without
     * one alike in every column that no other row of the file took. A file imported again, or the
     * export of this cellar, then adds nothing, while bottles alike in the file are all kept.
     */
    duplicate(bottle: ImportedRow): SkipReason | undefined {
        if (this.newBarcodes) return undefined;
        if (typeof bottle.barcode === 'string') {
            return this.barcodes.has(bottle.barcode)
                ? { code: 'same_barcode', barcode: bottle.barcode }
                : undefined;
        }
        const key = sameBottleKey(bottle);
        const count = this.alike.get(key) ?? 0;
        if (count === 0) return undefined;
        this.alike.set(key, count - 1);
        return { code: 'same_bottle' };
    }

    /** Why `bottle` does not fit in its case, if it does not: only available bottles count. */
    caseFull(bottle: ImportedRow): RowProblem | undefined {
        if (!isInCellar(bottle)) return undefined;
        const { name, capacity, bottles } = this.loads.get(bottle.storageCaseId as string)!;
        return bottles >= capacity ? { code: 'case_full', name, capacity } : undefined;
    }

    /**
     * `bottle` with its barcode: the next automatic one when the file gives none or the user chose
     * new ones, the one of the file otherwise. Only an available bottle takes a number: one out of
     * the cellar or consumed has no label to scan, and without a barcode it is recognised when the
     * file is imported again. With new barcodes, it loses the one of the file.
     */
    withBarcode(bottle: ImportedRow): ImportedRow {
        if (bottle.availability !== BottleAvailability.AVAILABLE) {
            return this.newBarcodes ? { ...bottle, barcode: null } : bottle;
        }
        if (!this.settings.autoGeneration || (bottle.barcode && !this.newBarcodes)) return bottle;
        this.nextNumber ??= getNextBarcodeNumber(this.settings, this.tx);
        let barcode: string;
        // A barcode of the cellar or of a later row may already be in the sequence.
        do {
            barcode = formatBarcode(this.settings.prefix, this.nextNumber++);
        } while (this.barcodes.has(barcode) || this.fileBarcodes.has(barcode));
        return { ...bottle, barcode };
    }

    added(bottle: ImportedRow): void {
        if (typeof bottle.barcode === 'string') this.barcodes.add(bottle.barcode);
        if (isInCellar(bottle)) this.loads.get(bottle.storageCaseId as string)!.bottles += 1;
    }

    /** As for the bottles added in the app, a number given stays given. */
    finish(): void {
        if (this.nextNumber === undefined) return;
        setLastBarcodeNumber(this.settings.prefix, this.nextNumber - 1, this.tx);
    }
}
