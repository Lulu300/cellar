import fs, { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDeflateRaw } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildZip, type ZipEntry } from '../../test/zip';
import { extractZip, InvalidZipError, withinExtractionLimits } from './zip';

let tempDir: string;
let destDir: string;

beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'cellar-zip-test-'));
    destDir = path.join(tempDir, 'extract', 'here');
});

afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
});

function writeZip(entries: ZipEntry[]): string {
    const zipPath = path.join(tempDir, 'upload.zip');
    writeFileSync(zipPath, buildZip(entries));
    return zipPath;
}

const acceptAll = () => true;

/**
 * Whether the descriptors opened on `file` from now on get closed. yauzl opens and closes the
 * archive with the callback forms of fs.open and fs.close, which the spies see.
 */
function watchDescriptors(file: string): () => boolean {
    const opened: number[] = [];
    const open = fs.open as (...args: unknown[]) => void;
    vi.spyOn(fs, 'open').mockImplementation(((target: fs.PathLike, ...rest: unknown[]) => {
        // The callback comes last, after optional flags and mode.
        const callback = rest.pop() as (error: NodeJS.ErrnoException | null, fd: number) => void;
        open(target, ...rest, (error: NodeJS.ErrnoException | null, fd: number) => {
            if (target === file) opened.push(fd);
            callback(error, fd);
        });
    }) as typeof fs.open);
    const close = vi.spyOn(fs, 'close');
    return () =>
        opened.length > 0 &&
        opened.every((fd) => close.mock.calls.some(([closed]) => closed === fd));
}

/** Real deflate data for `size` zeros, built in chunks so that the zeros never sit in memory. */
function deflateZeros(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const deflate = createDeflateRaw({ level: 1 });
        deflate.on('data', (chunk: Buffer) => chunks.push(chunk));
        deflate.on('end', () => resolve(Buffer.concat(chunks)));
        deflate.on('error', reject);

        const block = Buffer.alloc(64 * 1024 * 1024);
        let remaining = size;
        const writeMore = () => {
            while (remaining > 0) {
                const chunk = block.subarray(0, Math.min(block.length, remaining));
                remaining -= chunk.length;
                if (!deflate.write(chunk)) return deflate.once('drain', writeMore);
            }
            deflate.end();
        };
        writeMore();
    });
}

describe('extractZip', () => {
    it('extracts the accepted files, keeping their folders, and skips the rest', async () => {
        const zipPath = writeZip([
            { name: 'cellar.db', data: Buffer.from('database') },
            { name: 'images/' },
            { name: 'images/label.jpg', data: Buffer.from('jpeg bytes'), stored: true },
            { name: 'notes.txt', data: Buffer.from('ignored') }
        ]);

        const extracted = await extractZip(zipPath, destDir, (name) => name !== 'notes.txt');

        expect(extracted).toEqual(['cellar.db', 'images/label.jpg']);
        expect(readFileSync(path.join(destDir, 'cellar.db'), 'utf8')).toBe('database');
        expect(readFileSync(path.join(destDir, 'images/label.jpg'), 'utf8')).toBe('jpeg bytes');
        expect(existsSync(path.join(destDir, 'notes.txt'))).toBe(false);
    });

    it.each(['images/../../x', '/tmp/x'])(
        'refuses the entry name %s and writes nothing',
        async (name) => {
            const zipPath = writeZip([{ name, data: Buffer.from('payload') }]);

            await expect(extractZip(zipPath, destDir, acceptAll)).rejects.toBeInstanceOf(
                InvalidZipError
            );
            expect(existsSync(path.join(tempDir, 'extract', 'x'))).toBe(false);
            expect(existsSync(destDir)).toBe(false);
        }
    );

    // Deflating 2 GiB takes about a second here; the margin is for slow CI runners.
    it('refuses a zip bomb before inflating it', { timeout: 60_000 }, async () => {
        const size = 2 * 1024 * 1024 * 1024 + 1;
        const zipPath = writeZip([
            { name: 'cellar.db', compressed: await deflateZeros(size), uncompressedSize: size }
        ]);

        await expect(extractZip(zipPath, destDir, acceptAll)).rejects.toThrow(
            /too large once uncompressed/
        );
        expect(existsSync(destDir)).toBe(false);
    });

    // The sizes are only announced: the limit refuses the archive before reading any entry.
    it('adds up the sizes of all entries, extracted or not, against the limit', async () => {
        // Each under the 2 GiB limit, together over it.
        const declared = 1_200_000_000;
        const zipPath = writeZip([
            { name: 'one.bin', data: Buffer.from('x'), uncompressedSize: declared },
            { name: 'two.bin', data: Buffer.from('x'), uncompressedSize: declared }
        ]);

        await expect(extractZip(zipPath, destDir, () => false)).rejects.toThrow(
            /too large once uncompressed/
        );
    });

    it('accepts 10 000 entries and refuses more, before extracting any', async () => {
        const entries = (count: number) =>
            Array.from({ length: count }, (_, i): ZipEntry => ({
                name: `images/${i}.jpg`,
                stored: true
            }));

        await expect(extractZip(writeZip(entries(10_000)), destDir, () => false)).resolves.toEqual(
            []
        );
        await expect(extractZip(writeZip(entries(10_001)), destDir, acceptAll)).rejects.toThrow(
            /more than 10000 entries/
        );
        expect(existsSync(destDir)).toBe(false);
    });

    it.each([
        ['smaller', 10],
        ['larger', 2000]
    ])('refuses a header announcing a size %s than the content', async (_, uncompressedSize) => {
        const zipPath = writeZip([
            { name: 'cellar.db', data: Buffer.alloc(1000, 'a'), uncompressedSize }
        ]);

        await expect(extractZip(zipPath, destDir, acceptAll)).rejects.toBeInstanceOf(
            InvalidZipError
        );
    });

    it('refuses corrupt deflate data without leaking the file descriptor', async () => {
        // 0xff starts a block of type 3, which deflate does not define. The data must outlast the
        // stream buffers: a stream that read it all lets go of the archive by itself.
        const zipPath = writeZip([
            {
                name: 'cellar.db',
                data: Buffer.alloc(100),
                compressed: Buffer.alloc(1024 * 1024, 0xff)
            }
        ]);
        const allClosed = watchDescriptors(zipPath);

        await expect(extractZip(zipPath, destDir, acceptAll)).rejects.toBeInstanceOf(
            InvalidZipError
        );
        // yauzl closes the archive asynchronously once its last stream is gone.
        await vi.waitFor(() => expect(allClosed()).toBe(true));
    });

    it('refuses a file that is not a zip', async () => {
        const zipPath = path.join(tempDir, 'upload.zip');
        writeFileSync(zipPath, 'not a zip');

        await expect(extractZip(zipPath, destDir, acceptAll)).rejects.toBeInstanceOf(
            InvalidZipError
        );
    });
});

describe('withinExtractionLimits', () => {
    const entries = (count: number) =>
        Array.from({ length: count }, (_, i): ZipEntry => ({
            name: `images/${i}.jpg`,
            stored: true
        }));

    it('tells whether extractZip would take the zip, without extracting anything', async () => {
        await expect(withinExtractionLimits(writeZip(entries(10_000)))).resolves.toBe(true);
        await expect(withinExtractionLimits(writeZip(entries(10_001)))).resolves.toBe(false);
        const declared = 1_200_000_000;
        const tooLarge = writeZip([
            { name: 'cellar.db', data: Buffer.from('x'), uncompressedSize: declared },
            { name: 'images/a.jpg', data: Buffer.from('x'), uncompressedSize: declared }
        ]);
        await expect(withinExtractionLimits(tooLarge)).resolves.toBe(false);
        expect(existsSync(destDir)).toBe(false);
    });
});
