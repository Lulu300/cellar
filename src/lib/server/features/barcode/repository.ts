import { and, eq, inArray, isNotNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    producers,
    storageCases,
    wineBottles,
    wineColors,
    wineDefinitions,
    wineTypes
} from '#lib/server/db/schema.js';
import {
    getAppSetting,
    getAppSettingsStartingWith,
    setAppSetting,
    setAppSettings
} from '#lib/server/features/settings/repository.js';
import { BARCODE_LENGTH, LEGACY_BARCODE_LENGTH, maxBarcodeNumber } from '#lib/shared/barcode.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';

export interface BarcodeSettings {
    autoGeneration: boolean;
    prefix: string;
    startNumber: number;
}

const SETTING_KEYS = {
    autoGeneration: 'barcode_auto_generation',
    prefix: 'barcode_prefix',
    startNumber: 'barcode_start_number'
};

export function getBarcodeSettings(tx: Tx = db): BarcodeSettings {
    return {
        autoGeneration: getAppSetting(SETTING_KEYS.autoGeneration, tx)?.value === 'true',
        prefix: getAppSetting(SETTING_KEYS.prefix, tx)?.value || '',
        startNumber: parseInt(getAppSetting(SETTING_KEYS.startNumber, tx)?.value || '1', 10)
    };
}

/** Saves the three settings, all or none. */
export function saveBarcodeSettings(settings: BarcodeSettings, tx: Tx = db): void {
    setAppSettings(
        {
            [SETTING_KEYS.autoGeneration]: String(settings.autoGeneration),
            [SETTING_KEYS.prefix]: settings.prefix,
            [SETTING_KEYS.startNumber]: String(settings.startNumber)
        },
        tx
    );
}

/**
 * The setting that keeps the last number given to the codes of `prefix`. There is one per prefix,
 * so that coming back to an earlier prefix goes on after its own last number. Known limits: a
 * prefix that extends another one with digits writes the same codes (`CV0` + 1 and `CV` + 1 are
 * both CV00000001) but has its own counter, so it can give again the code of a deleted bottle of
 * the other prefix; never the code of an existing bottle, which the highest code counts. And since
 * the highest code counts, the shorter prefix shares its numbers with the longer one: after
 * 1230000002 of the prefix 123, the empty prefix goes on at 1230000003, and a sheet of labels
 * printed in advance for 123 then holds a code already taken.
 */
const LAST_BARCODE_NUMBER_KEY = 'barcode_last_number:';
const lastBarcodeNumberKey = (prefix: string) => LAST_BARCODE_NUMBER_KEY + prefix;

const parseLastBarcodeNumber = (value: string | undefined) => Number(value) || 0;

export const getLastBarcodeNumber = (prefix: string, tx: Tx = db) =>
    parseLastBarcodeNumber(getAppSetting(lastBarcodeNumberKey(prefix), tx)?.value);

/** Records `number` as the last one given to `prefix`, in the transaction that inserts its code. */
export function setLastBarcodeNumber(prefix: string, number: number, tx: Tx = db): void {
    setAppSetting(lastBarcodeNumberKey(prefix), String(number), tx);
}

/** The last number given to each prefix, for putBackLastBarcodeNumbers. */
export function getLastBarcodeNumbers(tx: Tx = db): Map<string, number> {
    return new Map(
        getAppSettingsStartingWith(LAST_BARCODE_NUMBER_KEY, tx).map(({ key, value }) => [
            key.slice(LAST_BARCODE_NUMBER_KEY.length),
            parseLastBarcodeNumber(value)
        ])
    );
}

/**
 * The codes of `prefix` that the app generated, compared exactly, capitals included, and the number
 * that follows the prefix in each one.
 *
 * Only the formats the app generated count: another manual code with the same prefix, such as a
 * 13-digit EAN, would push the sequence past its last number. The old 13-character codes count
 * too, so that new labels do not reuse their numbers. With a prefix of digits only, the default
 * empty one included, such a code looks like an EAN-13: it then counts only when its number fits
 * the current format, so that an EAN can skip numbers at worst, never use up the prefix.
 */
function generatedBarcodes(prefix: string): { condition: SQL; number: SQL } {
    const barcode = wineBottles.barcode;
    const digits = sql`substr(${barcode}, ${prefix.length + 1})`;
    const number = sql`CAST(${digits} AS INTEGER)`;
    const oldCodeCounts = /^\d*$/.test(prefix)
        ? sql`${number} <= ${maxBarcodeNumber(prefix)}`
        : sql`1`;
    const condition = sql`substr(${barcode}, 1, ${prefix.length}) = ${prefix}
        AND ${digits} NOT GLOB '*[^0-9]*'
        AND (length(${barcode}) = ${BARCODE_LENGTH}
            OR (length(${barcode}) = ${LEGACY_BARCODE_LENGTH} AND ${oldCodeCounts}))`;
    return { condition, number };
}

/** The highest number of the codes of `prefix` that the app generated, 0 when there is none. */
export function highestGeneratedBarcodeNumber(prefix: string, tx: Tx = db): number {
    const { condition, number } = generatedBarcodes(prefix);
    const row = tx
        .select({ highest: sql<number | null>`max(${number})` })
        .from(wineBottles)
        .where(condition)
        .get();
    return row?.highest ?? 0;
}

const hasBarcode = and(isNotNull(wineBottles.barcode), ne(wineBottles.barcode, ''));

const countBottles = (condition: SQL | undefined) =>
    db
        .select({ count: sql<number>`count(*)` })
        .from(wineBottles)
        .where(condition)
        .get()?.count ?? 0;

/** The number of bottles with a barcode, whatever it is. */
export const countBottlesWithBarcode = () => countBottles(hasBarcode);

/** The number of bottles with a code that the app generated for `prefix`. */
export const countGeneratedBarcodes = (prefix: string) =>
    countBottles(generatedBarcodes(prefix).condition);

/** A bottle with a barcode, with what a label sheet lists about its wine. */
export interface BarcodeRow {
    barcode: string | null;
    vintage: number | null;
    wineName: string;
    producer: string | null;
    appellationName: string;
    typeName: string;
    colorName: string;
    storageCaseName: string | null;
}

/** The bottles with a barcode that `condition` selects, in the order of their barcodes. */
function barcodeRows(condition: SQL | undefined): BarcodeRow[] {
    return (
        db
            .select({
                barcode: wineBottles.barcode,
                vintage: wineBottles.vintage,
                wineName: wineDefinitions.name,
                producer: producers.name,
                appellationName: appellations.name,
                typeName: wineTypes.type,
                colorName: wineColors.color,
                storageCaseName: storageCases.name
            })
            .from(wineBottles)
            .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
            .innerJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
            .innerJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
            .innerJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
            .leftJoin(producers, eq(wineDefinitions.producerId, producers.id))
            // A drunk bottle keeps the case it was in, but is not there: its line names no place.
            .leftJoin(
                storageCases,
                and(
                    eq(wineBottles.storageCaseId, storageCases.id),
                    ne(wineBottles.availability, BottleAvailability.CONSUMED)
                )
            )
            .where(and(hasBarcode, condition))
            .orderBy(wineBottles.barcode)
            .all()
    );
}

/** Every bottle with a barcode. */
export const bottlesWithAnyBarcode = () => barcodeRows(undefined);

/** The bottles with a code that the app generated for `prefix`. */
export const bottlesWithGeneratedBarcodes = (prefix: string) =>
    barcodeRows(generatedBarcodes(prefix).condition);

/** The bottles that have one of `barcodes`. */
export const bottlesWithBarcodes = (barcodes: string[]) =>
    barcodeRows(inArray(wineBottles.barcode, barcodes));
