import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import path from 'node:path';

interface ImageType {
    extension: string;
    mimeType: string;
}

/**
 * Identifies the image formats the app accepts from their first bytes, so neither the client
 * file name nor its announced MIME type decides what gets stored. Returns null for anything else.
 */
export function detectImageType(bytes: Buffer): ImageType | null {
    const ascii = (start: number, end: number) => bytes.toString('latin1', start, end);

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { extension: 'jpg', mimeType: 'image/jpeg' };
    }
    if (
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
        return { extension: 'png', mimeType: 'image/png' };
    }
    if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') {
        return { extension: 'gif', mimeType: 'image/gif' };
    }
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
        return { extension: 'webp', mimeType: 'image/webp' };
    }
    return null;
}

// What detectImageType reads at most.
const IMAGE_HEAD_BYTES = 12;

/** detectImageType for the file `file`, which it reads only the first bytes of. */
export async function detectImageFileType(file: string): Promise<ImageType | null> {
    const handle = await open(file, 'r');
    try {
        const head = Buffer.alloc(IMAGE_HEAD_BYTES);
        const { bytesRead } = await handle.read(head, 0, IMAGE_HEAD_BYTES, 0);
        return detectImageType(head.subarray(0, bytesRead));
    } finally {
        await handle.close();
    }
}

/** The name an uploaded image is stored under, whatever the client called it. */
export function newImageFileName(type: ImageType): string {
    return `wine-${randomUUID()}.${type.extension}`;
}

// The extensions an image of the app may have: those of the formats detectImageType accepts.
const IMAGE_CONTENT_TYPES = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp']
]);

/** The MIME type of an image named `filename`, by its extension; undefined for another extension. */
export function imageContentType(filename: string): string | undefined {
    return IMAGE_CONTENT_TYPES.get(path.extname(filename).toLowerCase());
}
