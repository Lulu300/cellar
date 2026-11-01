import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    appellations,
    countries,
    regions,
    wineDefinitions,
    wineImages,
    wineTypes
} from '#lib/server/db/schema.js';
import { addWinePhoto, listWinePhotos } from '#lib/server/features/images/service.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { migrationsBefore } from '../../../../test/database';
import { fileOf, jpegBytes } from '../../../../test/image';
import { backupZip, restore } from '../../../../test/restore';

// The schema of 1.2.0, the last version whose wines had a single image.
const migrations12 = migrationsBefore('0016_wine_photos');

afterAll(() => {
    rmSync(migrations12, { recursive: true, force: true });
});

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('POST /api/admin/restore of a backup made before wines had several photos', () => {
    it('makes the image of each wine its main photo, kept as it was, and takes more photos', async () => {
        const timestamps = { createdAt: new Date(), updatedAt: new Date() };
        const file = backupZip(
            (backup) => {
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
                        imageId: 'label',
                        ...timestamps
                    })
                    .run();
            },
            {
                migrationsFolder: migrations12,
                extraEntries: [{ name: 'images/label.jpg', data: jpegBytes('label of 1.2.0') }]
            }
        );

        expect((await restore(file)).status).toBe(200);

        expect(listWinePhotos('margaux')).toEqual([
            { imageId: 'label', url: '/uploads/wines/label.jpg', main: true }
        ]);
        expect(readFileSync(path.join(IMAGES_DIR, 'label.jpg'))).toEqual(
            jpegBytes('label of 1.2.0')
        );
        const photos = await addWinePhoto('margaux', fileOf('back.jpg', jpegBytes('back')));
        expect(photos.map(({ imageId, main }) => ({ imageId, main }))).toEqual([
            { imageId: 'label', main: true },
            { imageId: expect.any(String), main: false }
        ]);
    });
});
