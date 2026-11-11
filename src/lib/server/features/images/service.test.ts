import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { producers, wineImages } from '#lib/server/db/schema.js';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { fileOf, jpegBytes } from '../../../../test/image';
import {
    deleteImages,
    dropUnusedImages,
    listImagesWithStats,
    listImageUrls,
    uploadImage,
    uploadImages,
    zipImages
} from './service';

beforeEach(() => {
    db.delete(producers).run();
    db.delete(wineImages).run();
    for (const name of readdirSync(IMAGES_DIR)) rmSync(path.join(IMAGES_DIR, name));
});

describe('uploadImages', () => {
    it('saves each image under a new name, and reports the files that are not images', async () => {
        const result = await uploadImages([
            fileOf('label.jpg', jpegBytes('label')),
            fileOf('notes.txt', Buffer.from('not an image'))
        ]);

        expect(result.successful).toEqual([
            expect.objectContaining({
                originalFilename: 'label.jpg',
                filename: expect.stringMatching(/^wine-.*\.jpg$/)
            })
        ]);
        expect(result.failed).toEqual([
            { filename: 'notes.txt', error: 'File must be a JPEG, PNG, WebP or GIF image' }
        ]);
        expect(readdirSync(IMAGES_DIR)).toEqual([result.successful[0].filename]);
        expect(listImageUrls()).toEqual([
            {
                id: result.successful[0].imageId,
                url: `/uploads/wines/${result.successful[0].filename}`
            }
        ]);
    });

    it('refuses a request without images', async () => {
        await expect(uploadImages([])).rejects.toMatchObject({ status: 422 });
    });
});

describe('zipImages', () => {
    it('zips the files of the images that exist, and answers 404 when none does', async () => {
        const { successful } = await uploadImages([fileOf('label.jpg', jpegBytes('label'))]);
        const { imageId, filename } = successful[0];

        const { body } = await zipImages(['unknown', imageId]);
        const zip = Buffer.from(await new Response(body).arrayBuffer());
        expect(zip.subarray(0, 2).toString()).toBe('PK');
        expect(zip.includes(Buffer.from(filename))).toBe(true);

        rmSync(path.join(IMAGES_DIR, filename));
        writeFileSync(path.join(IMAGES_DIR, 'other.jpg'), jpegBytes('other'));
        await expect(zipImages([imageId])).rejects.toMatchObject({ status: 404 });
        await expect(zipImages(['unknown'])).rejects.toMatchObject({ status: 404 });
    });

    it('removes its temporary zip once the zip is read, or once the download is cancelled', async () => {
        const { successful } = await uploadImages([fileOf('label.jpg', jpegBytes('label'))]);
        const tempZips = () => readdirSync(DATA_DIR).filter((name) => name.startsWith('temp-'));
        // The zip of the test before is removed once its stream closes
        await vi.waitFor(() => expect(tempZips()).toEqual([]));

        const read = await zipImages([successful[0].imageId]);
        expect(tempZips()).toHaveLength(1);
        await new Response(read.body).arrayBuffer();
        await vi.waitFor(() => expect(tempZips()).toEqual([]));

        const cancelled = await zipImages([successful[0].imageId]);
        await cancelled.body.cancel();
        await vi.waitFor(() => expect(tempZips()).toEqual([]));
    });
});

// A producer's photo is a use like a wine's (FEAT-07): the admin must not offer it as unused.
describe('the photo of a producer', () => {
    async function producerWithPhoto() {
        const { imageId } = await uploadImage(fileOf('estate.jpg', jpegBytes('estate')));
        db.insert(producers).values({ id: 'huet', name: 'Huet', imageId }).run();
        return imageId;
    }

    it('lists the producer as a user of the image, and keeps it from a cleanup', async () => {
        const imageId = await producerWithPhoto();

        const [image] = await listImagesWithStats();
        expect(image).toMatchObject({ id: imageId, producers: [{ id: 'huet', name: 'Huet' }] });
        expect(db.transaction((tx) => dropUnusedImages([imageId], tx))).toEqual([]);
    });

    it('refuses its deletion without force, and takes it from the producer with force', async () => {
        const imageId = await producerWithPhoto();

        await expect(deleteImages([imageId], false)).rejects.toMatchObject({ code: 'in_use' });
        await deleteImages([imageId], true);
        expect(db.select().from(producers).get()?.imageId).toBeNull();
    });
});
