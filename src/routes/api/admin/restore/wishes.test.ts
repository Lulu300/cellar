import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    wineColors,
    wineDefinitions,
    wineImages,
    wineTypes,
    wishes
} from '#lib/server/db/schema.js';
import { createWish, listWishes } from '#lib/server/features/wishlist/service.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';
import { startingHex } from '#lib/shared/wine-colors.js';
import { migrationsBefore } from '../../../../test/database';
import { jpegBytes } from '../../../../test/image';
import { backupZip, restore } from '../../../../test/restore';

// The schema of 1.2.0, the last version without a wishlist.
const migrations12 = migrationsBefore('0016_wine_photos');

afterAll(() => {
    rmSync(migrations12, { recursive: true, force: true });
});

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

const timestamps = { createdAt: new Date(), updatedAt: new Date() };

/** A wine, Château Margaux, with the rows it needs, and the image label.jpg. */
function fillCellar(backup: Db) {
    backup
        .insert(countries)
        .values({ id: 'fr', name: 'France', ...timestamps })
        .run();
    backup
        .insert(regions)
        .values({ id: 'bdx', name: 'Bordeaux', countryId: 'fr', ...timestamps })
        .run();
    backup
        .insert(appellations)
        .values({ id: 'mgx', name: 'Margaux', regionId: 'bdx', ...timestamps })
        .run();
    backup
        .insert(wineTypes)
        .values({ id: 'still', type: 'Still', ...timestamps })
        .run();
    // In SQL: the colours of older versions have no hex, which Drizzle's insert would give.
    backup.$client.exec(
        "INSERT INTO wine_colors (id, color, created_at, updated_at) VALUES ('red', 'Red', 0, 0)"
    );
    backup
        .insert(wineImages)
        .values({ id: 'label', filename: 'label.jpg', ...timestamps })
        .run();
    backup
        .insert(wineDefinitions)
        .values({
            id: 'margaux',
            name: 'Château Margaux',
            appellationId: 'mgx',
            typeId: 'still',
            colorId: 'red',
            ...timestamps
        })
        .run();
}

const label = { name: 'images/label.jpg', data: jpegBytes('label') };

describe('POST /api/admin/restore and the wishlist', () => {
    it('upgrades a backup of 1.2.0 to an empty wishlist, which then takes wishes', async () => {
        const file = backupZip(fillCellar, {
            migrationsFolder: migrations12,
            extraEntries: [label]
        });

        expect((await restore(file)).status).toBe(200);

        // Its colours get the colour value of their name (FEAT-03, migration 0019).
        expect(db.select().from(wineColors).all()).toMatchObject([
            { color: 'Red', hex: startingHex('Red') }
        ]);
        expect(listWishes()).toEqual([]);
        createWish(wishSchema.parse({ definitionId: 'margaux', quantity: 3 }));
        expect(listWishes()).toMatchObject([
            { quantity: 3, wine: { id: 'margaux', name: 'Château Margaux' } }
        ]);
    });

    it('puts back the wishes of a backup, with the photo of a text wish', async () => {
        const file = backupZip(
            (backup) => {
                fillCellar(backup);
                backup
                    .insert(wishes)
                    .values([
                        { id: 'again', definitionId: 'margaux', note: 'Six more', ...timestamps },
                        { id: 'idea', text: 'Clos Rougeard', imageId: 'label', ...timestamps }
                    ])
                    .run();
            },
            { extraEntries: [label] }
        );

        expect((await restore(file)).status).toBe(200);

        expect(listWishes()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'again', note: 'Six more', wine: expect.anything() }),
                expect.objectContaining({
                    id: 'idea',
                    text: 'Clos Rougeard',
                    imageUrl: '/uploads/wines/label.jpg'
                })
            ])
        );
        expect(readFileSync(path.join(IMAGES_DIR, 'label.jpg'))).toEqual(jpegBytes('label'));
    });
});
