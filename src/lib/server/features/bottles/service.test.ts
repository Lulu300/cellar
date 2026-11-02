import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, wineBottles } from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { BarcodeRangeError } from '#lib/shared/barcode.js';
import { failWrites } from '../../../../test/failing-write';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { getBarcodeSettings, getNextBarcodeNumber } from '#lib/server/features/barcode/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { createBottles, deleteWineBottle, updateBottles, updateWineBottle } from './service';

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
});

beforeEach(async () => {
    await db.delete(wineBottles);
    await db.delete(appSettings);
});

function useBarcodes(settings: { auto: boolean; prefix?: string; start?: number }) {
    setAppSetting('barcode_auto_generation', String(settings.auto));
    setAppSetting('barcode_prefix', settings.prefix ?? '');
    setAppSetting('barcode_start_number', String(settings.start ?? 1));
}

function addBottles(quantity: number, extra: { barcode?: string } = {}) {
    return createBottles(bottleData(definitionId, extra), quantity);
}

const barcodes = (bottles: { barcode: string | null }[]) => bottles.map((bottle) => bottle.barcode);

const caseFull = expect.objectContaining({ status: 409, code: 'case_full' });

/** A new case of `capacity`, in a container of its own; returns its id. */
function newCase(capacity: number): string {
    return createContainer({
        name: `Rack ${Math.random()}`,
        cases: ['1'],
        caseCapacities: [capacity]
    }).cases[0].id;
}

const bottlesIn = (caseId: string) =>
    db.select().from(wineBottles).where(eq(wineBottles.storageCaseId, caseId)).all();

describe('the capacity of a case', () => {
    const inCase = (storageCaseId: string, fields: Record<string, unknown> = {}) =>
        bottleData(definitionId, { storageCaseId, ...fields });

    it('refuses more new bottles than the case has room for, creating none', () => {
        useBarcodes({ auto: true, prefix: 'CV' });
        const caseId = newCase(3);
        createBottles(inCase(caseId), 2);

        expect(() => createBottles(inCase(caseId), 2)).toThrow(caseFull);
        expect(bottlesIn(caseId)).toHaveLength(2);
        // The barcodes of the refused bottles are not used up.
        expect(getNextBarcodeNumber(getBarcodeSettings())).toBe(3);
        expect(createBottles(inCase(caseId), 1)).toHaveLength(1);
    });

    it('takes bottles out of the cellar in a full case, which hold no place', () => {
        useBarcodes({ auto: false });
        const caseId = newCase(1);
        createBottles(inCase(caseId), 1);

        expect(createBottles(inCase(caseId, { availability: 'out_of_cellar' }), 2)).toHaveLength(2);
    });

    it('refuses to move a bottle into a full case, or to bring one back into it', () => {
        useBarcodes({ auto: false });
        const full = newCase(1);
        createBottles(inCase(full), 1);
        const [elsewhere] = createBottles(inCase(newCase(5)), 1);
        const [away] = createBottles(inCase(full, { availability: 'out_of_cellar' }), 1);

        expect(() => updateWineBottle(elsewhere.id, inCase(full))).toThrow(caseFull);
        expect(() => updateWineBottle(away.id, inCase(full))).toThrow(caseFull);
        expect(
            bottlesIn(full).filter((bottle) => bottle.availability === 'available')
        ).toHaveLength(1);
    });

    it('still edits a bottle of a case over its capacity, and moves one out of it', () => {
        useBarcodes({ auto: false });
        const caseId = newCase(1);
        // As an import or an older version could leave it
        const [first, second] = createBottles(inCase(caseId, { availability: 'out_of_cellar' }), 2);
        db.update(wineBottles).set({ availability: 'available' }).run();

        expect(updateWineBottle(first.id, inCase(caseId, { notes: 'For Sunday' })).notes).toBe(
            'For Sunday'
        );
        expect(updateWineBottle(second.id, inCase(newCase(5))).storageCaseId).not.toBe(caseId);
    });
});

describe('updateBottles', () => {
    /** `quantity` bottles with every field set, each with its own barcode, in a case of 50. */
    function fullBottles(quantity: number, caseId = newCase(50)) {
        useBarcodes({ auto: true, prefix: 'UB' });
        return createBottles(
            bottleData(definitionId, {
                vintage: 2015,
                optimum: 2030,
                purchasePrice: 42.5,
                purchaseDate: '2024-03-01T10:20:30.000Z',
                currentValue: 60,
                currentValueDate: '2026-01-15T08:00:00.000Z',
                storageCaseId: caseId,
                notes: 'Gift from Anna'
            }),
            quantity
        );
    }

    const rows = () => db.select().from(wineBottles).orderBy(wineBottles.id).all();
    /** `row` with `fields` changed, at any time. */
    const changed = (row: object, fields: object) => ({
        ...row,
        ...fields,
        updatedAt: expect.any(Date)
    });

    it('changes the status of 10 bottles and no other column', () => {
        const ids = fullBottles(10).map((bottle) => bottle.id);
        const before = rows();

        const updated = updateBottles(ids, { availability: BottleAvailability.OUT_OF_CELLAR });

        expect(updated.map((bottle) => bottle.id)).toEqual(ids);
        expect(rows()).toEqual(
            before.map((row) => changed(row, { availability: BottleAvailability.OUT_OF_CELLAR }))
        );
    });

    it('changes only the fields given on one bottle', () => {
        const [bottle] = fullBottles(1);
        const [before] = rows();

        updateWineBottle(bottle.id, { notes: 'Open with the cheese', vintage: null });

        expect(rows()).toEqual([changed(before, { notes: 'Open with the cheese', vintage: null })]);
    });

    it('changes nothing when one of the bottles does not exist, and names it', () => {
        const ids = fullBottles(3).map((bottle) => bottle.id);
        const before = rows();

        expect(() =>
            updateBottles([...ids, 'gone', 'lost'], {
                availability: BottleAvailability.OUT_OF_CELLAR
            })
        ).toThrow(expect.objectContaining({ status: 404, details: { ids: ['gone', 'lost'] } }));
        expect(rows()).toEqual(before);
    });

    it('changes nothing when the write of one bottle fails', () => {
        const ids = fullBottles(3).map((bottle) => bottle.id);
        const before = rows();
        failWrites('UPDATE', 'wine_bottles', `OLD.id = '${ids[2]}'`);

        expect(() => updateBottles(ids, { notes: 'Tasted' })).toThrow();
        expect(rows()).toEqual(before);
    });

    it('moves no bottle when the case has no room for all of them', () => {
        const ids = fullBottles(3).map((bottle) => bottle.id);
        const small = newCase(4);
        createBottles(bottleData(definitionId, { storageCaseId: small }), 2);
        const before = rows();

        expect(() => updateBottles(ids, { storageCaseId: small })).toThrow(caseFull);
        expect(rows()).toEqual(before);
        expect(updateBottles(ids.slice(0, 2), { storageCaseId: small })).toHaveLength(2);
    });

    // A bottle drunk keeps its case as one taken out does (FEAT-12): either comes back to it.
    it.each([BottleAvailability.OUT_OF_CELLAR, BottleAvailability.CONSUMED])(
        'brings no bottle %s back into a full case, nor bottles that would fill it past capacity',
        (away) => {
            const caseId = newCase(3);
            const ids = fullBottles(3, caseId).map((bottle) => bottle.id);
            updateBottles(ids, { availability: away });
            expect(bottlesIn(caseId)).toHaveLength(3);
            createBottles(bottleData(definitionId, { storageCaseId: caseId }), 1);

            expect(() =>
                updateBottles(ids, { availability: BottleAvailability.AVAILABLE })
            ).toThrow(caseFull);
            expect(bottlesIn(caseId).filter((b) => b.availability === 'available')).toHaveLength(1);
            expect(
                updateBottles(ids.slice(0, 2), { availability: BottleAvailability.AVAILABLE })
            ).toEqual([
                expect.objectContaining({ storageCaseId: caseId, consumedDate: null }),
                expect.objectContaining({ storageCaseId: caseId, consumedDate: null })
            ]);
        }
    );

    it('still takes bottles out of a case over its capacity', () => {
        const caseId = newCase(1);
        const ids = fullBottles(3).map((bottle) => bottle.id);
        // As an import or an older version could leave it
        db.update(wineBottles).set({ storageCaseId: caseId }).run();

        expect(
            updateBottles(ids.slice(0, 1), { availability: BottleAvailability.OUT_OF_CELLAR })
        ).toHaveLength(1);
        expect(updateBottles(ids.slice(1), { notes: 'Still here' })).toHaveLength(2);
    });

    it('refuses one manual barcode for several bottles, and changes nothing', () => {
        const ids = fullBottles(2).map((bottle) => bottle.id);
        const before = rows();

        expect(() => updateBottles(ids, { barcode: 'MY-CODE', notes: 'x' })).toThrow(
            expect.objectContaining({ status: 422, code: 'barcode_for_one_bottle' })
        );
        expect(rows()).toEqual(before);
        // The same bottle twice is one bottle.
        expect(updateBottles([ids[0], ids[0]], { barcode: 'MY-CODE' })).toHaveLength(1);
    });

    it('removes the barcode of several bottles', () => {
        const ids = fullBottles(2).map((bottle) => bottle.id);

        expect(barcodes(updateBottles(ids, { barcode: null }))).toEqual([null, null]);
    });

    it('refuses the barcode of another bottle, and changes nothing', () => {
        const [first, second] = fullBottles(2);
        const before = rows();

        // The API answers it with 409 duplicate_barcode.
        expect(() => updateWineBottle(second.id, { barcode: first.barcode })).toThrow(
            'UNIQUE constraint failed: wine_bottles.barcode'
        );
        expect(rows()).toEqual(before);
    });

    it('applies the consumption rule to the bottle as changed', () => {
        const caseId = newCase(50);
        const [bottle] = fullBottles(1, caseId);
        const consumedDate = new Date('2026-10-01');

        expect(
            updateWineBottle(bottle.id, { availability: BottleAvailability.CONSUMED, consumedDate })
        ).toMatchObject({ storageCaseId: caseId, consumedDate });
        // A consumed bottle keeps its date when another field changes, and the case it was in.
        expect(updateWineBottle(bottle.id, { notes: 'Lovely' })).toMatchObject({
            storageCaseId: caseId,
            consumedDate
        });
        expect(
            updateWineBottle(bottle.id, { availability: BottleAvailability.OUT_OF_CELLAR })
                .consumedDate
        ).toBeNull();
    });
});

describe('updateWineBottle and deleteWineBottle', () => {
    it('answer 404 for a bottle that does not exist', () => {
        const notFound = expect.objectContaining({ status: 404 });
        expect(() => updateWineBottle('nowhere', bottleData(definitionId))).toThrow(notFound);
        expect(() => deleteWineBottle('nowhere')).toThrow(notFound);
    });
});

describe('createBottles', () => {
    it('gives each bottle the next sequential barcode', async () => {
        useBarcodes({ auto: true, prefix: 'CV' });

        const bottles = await addBottles(3);

        expect(barcodes(bottles)).toEqual(['CV00000001', 'CV00000002', 'CV00000003']);
        expect(await db.select().from(wineBottles)).toHaveLength(3);
    });

    it('starts at the configured number', async () => {
        useBarcodes({ auto: true, prefix: 'CV', start: 500 });

        expect(barcodes(await addBottles(1))).toEqual(['CV00000500']);
    });

    it('continues after the highest barcode with the same prefix', async () => {
        useBarcodes({ auto: false });
        for (const barcode of ['CV00000041', 'CV00000007', 'XX00000900']) {
            await addBottles(1, { barcode });
        }
        useBarcodes({ auto: true, prefix: 'CV' });

        expect(barcodes(await addBottles(1))).toEqual(['CV00000042']);
    });

    it('ignores manual codes that do not follow the sequential format', async () => {
        useBarcodes({ auto: false });
        for (const barcode of ['0000000041', '3760123456789', '12345ABCDE']) {
            await addBottles(1, { barcode });
        }
        useBarcodes({ auto: true });

        expect(barcodes(await addBottles(1))).toEqual(['0000000042']);
    });

    it('refuses to go past the last number of the prefix', async () => {
        useBarcodes({ auto: false });
        await addBottles(1, { barcode: 'CELLAR9999' });
        useBarcodes({ auto: true, prefix: 'CELLAR' });

        expect(() => addBottles(1)).toThrow(BarcodeRangeError);
        expect(await db.select().from(wineBottles)).toHaveLength(1);
    });

    describe('with the 13-character codes generated before September 2025', () => {
        async function useOldCodes(codes: string[], prefix: string) {
            useBarcodes({ auto: false });
            for (const barcode of codes) {
                await addBottles(1, { barcode });
            }
            useBarcodes({ auto: true, prefix });
        }

        it('continues after the highest old code', async () => {
            await useOldCodes(['OLDCV10000374', 'OLDCV10000012'], 'OLDCV1');

            expect(barcodes(await addBottles(1))).toEqual(['OLDCV10375']);
        });

        it('continues after the highest code when both formats are present', async () => {
            await useOldCodes(['CV00000000374', 'CV00000400', 'CV00000000012'], 'CV');

            expect(barcodes(await addBottles(1))).toEqual(['CV00000401']);

            await useOldCodes(['CV00000000900'], 'CV');

            expect(barcodes(await addBottles(1))).toEqual(['CV00000901']);
        });

        it('ignores old codes of another prefix', async () => {
            await useOldCodes(['OLDCV10000374', 'CV00000000900'], 'OLDCV2');

            expect(barcodes(await addBottles(1))).toEqual(['OLDCV20001']);
        });

        it('with a prefix of digits only, counts them only when the number fits the current format', async () => {
            await useOldCodes(['3760123456789', '0000000000374'], '');
            expect(barcodes(await addBottles(1))).toEqual(['0000000375']);

            // 3760123456789 is still there, and a barcode cannot be on two bottles.
            await useOldCodes(['3700000000374'], '37');
            expect(barcodes(await addBottles(1))).toEqual(['3700000375']);
        });

        it('refuses to go past the last number of the prefix', async () => {
            await useOldCodes(['OLDCV10009999'], 'OLDCV1');

            expect(() => addBottles(1)).toThrow(BarcodeRangeError);
            expect(await db.select().from(wineBottles)).toHaveLength(1);
        });

        it('refuses an old number that is already past the last number of the prefix', async () => {
            await useOldCodes(['OLDCV10012345'], 'OLDCV1');

            expect(() => addBottles(1)).toThrow(BarcodeRangeError);
            expect(await db.select().from(wineBottles)).toHaveLength(1);
        });

        it('with the empty prefix, counts an old code up to the last number of the format', async () => {
            await useOldCodes(['0010000000000'], '');
            expect(barcodes(await addBottles(1))).toEqual(['0000000001']);

            await useOldCodes(['0009999999999'], '');
            expect(() => addBottles(1)).toThrow(BarcodeRangeError);
        });
    });

    describe('with the last number given', () => {
        const nextNumber = () => getNextBarcodeNumber(getBarcodeSettings());

        it('does not give it again when its bottle is deleted', async () => {
            useBarcodes({ auto: true, prefix: 'CV' });
            const [, , last] = await addBottles(3);
            await db.delete(wineBottles).where(eq(wineBottles.id, last.id));

            expect(nextNumber()).toBe(4);
            expect(barcodes(await addBottles(1))).toEqual(['CV00000004']);
        });

        it('keeps one for each prefix', async () => {
            useBarcodes({ auto: true, prefix: 'CV' });
            await addBottles(2);
            useBarcodes({ auto: true, prefix: 'XX' });
            expect(barcodes(await addBottles(1))).toEqual(['XX00000001']);

            await db.delete(wineBottles);
            useBarcodes({ auto: true, prefix: 'CV' });
            expect(barcodes(await addBottles(1))).toEqual(['CV00000003']);
        });

        it('continues after a higher code put in the cellar another way', async () => {
            useBarcodes({ auto: true, prefix: 'CV' });
            await addBottles(1);
            useBarcodes({ auto: false });
            await addBottles(1, { barcode: 'CV00000050' });
            useBarcodes({ auto: true, prefix: 'CV' });

            expect(barcodes(await addBottles(1))).toEqual(['CV00000051']);
        });

        it('keeps it when the creation fails', async () => {
            useBarcodes({ auto: true, prefix: 'CV' });
            await addBottles(1);
            failWrites('INSERT', 'wine_bottles', "NEW.barcode = 'CV00000003'");

            expect(() => addBottles(3)).toThrow();
            expect(nextNumber()).toBe(2);
        });
    });

    it('uses a manual barcode when generation is off', async () => {
        useBarcodes({ auto: false });

        expect(barcodes(await addBottles(1, { barcode: 'MY-CODE' }))).toEqual(['MY-CODE']);
    });

    it('refuses a manual barcode for several bottles, which cannot all have it', async () => {
        useBarcodes({ auto: false });

        expect(() => addBottles(2, { barcode: 'MY-CODE' })).toThrow(
            expect.objectContaining({ status: 422, code: 'barcode_for_one_bottle' })
        );
        expect(await db.select().from(wineBottles)).toEqual([]);
    });

    it('keeps the barcode given to one bottle when generation is on, taking no number', async () => {
        useBarcodes({ auto: true, prefix: 'CV' });

        expect(barcodes(await addBottles(1, { barcode: 'MY-CODE' }))).toEqual(['MY-CODE']);
        expect(barcodes(await addBottles(1))).toEqual(['CV00000001']);
    });

    it('refuses a barcode given to several bottles when generation is on', async () => {
        useBarcodes({ auto: true, prefix: 'CV' });

        expect(() => addBottles(2, { barcode: 'MY-CODE' })).toThrow(
            expect.objectContaining({ status: 422, code: 'barcode_for_one_bottle' })
        );
        expect(await db.select().from(wineBottles)).toEqual([]);
    });

    it('gives the next barcode to available bottles only, as the CSV import does', async () => {
        useBarcodes({ auto: true, prefix: 'CV' });

        for (const availability of [
            BottleAvailability.CONSUMED,
            BottleAvailability.OUT_OF_CELLAR
        ]) {
            const bottles = await createBottles(bottleData(definitionId, { availability }), 2);
            expect(barcodes(bottles)).toEqual([null, null]);
        }
        expect(barcodes(await addBottles(1))).toEqual(['CV00000001']);
    });

    it('answers each bottle with the name of its format', async () => {
        useBarcodes({ auto: false });

        expect(await addBottles(1)).toMatchObject([{ formatId: 'bottle', format: 'Bottle' }]);
    });

    it('keeps the case of a consumed bottle, and dates only the consumption of a consumed one', async () => {
        useBarcodes({ auto: false });
        const consumedDate = '2026-10-01';
        const caseId = newCase(5);

        const [drunk] = await createBottles(
            bottleData(definitionId, {
                availability: 'consumed',
                storageCaseId: caseId,
                consumedDate
            }),
            1
        );
        const [kept] = await createBottles(bottleData(definitionId, { consumedDate }), 1);

        expect(drunk).toMatchObject({
            storageCaseId: caseId,
            consumedDate: new Date(consumedDate)
        });
        expect(kept.consumedDate).toBeNull();
        expect(
            updateWineBottle(kept.id, bottleData(definitionId, { consumedDate }))?.consumedDate
        ).toBeNull();
    });
});
