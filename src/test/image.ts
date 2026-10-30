import { db } from '#lib/server/db/index.js';
import { wineImages } from '#lib/server/db/schema.js';

/** Bytes that the app recognises as a JPEG image: its signature, then `text`. */
export function jpegBytes(text: string): Buffer {
    return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(text)]);
}

/** A file named `name` that holds `bytes`, as an upload form carries it. */
export function fileOf(name: string, bytes: Buffer): File {
    return new File([new Uint8Array(bytes)], name);
}

/** Inserts the row of an image named `filename`, without writing its file. */
export async function insertImageRow(id: string, filename: string): Promise<void> {
    const now = new Date();
    await db.insert(wineImages).values({ id, filename, createdAt: now, updatedAt: now });
}
