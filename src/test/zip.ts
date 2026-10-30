import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
    name: string;
    /** The file content, deflated unless `stored` is set. */
    data?: Buffer;
    stored?: boolean;
    /** Crafted entries: bytes written as the compressed data, in place of `data` deflated. */
    compressed?: Buffer;
    /** Crafted entries: the size the headers announce, in place of the real one. */
    uncompressedSize?: number;
}

/**
 * Builds a zip archive byte by byte. Archiving libraries refuse to write the hostile archives the
 * tests need (`..` in names, sizes that lie, broken deflate data), hence this.
 */
export function buildZip(entries: ZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name);
        const data = entry.data ?? Buffer.alloc(0);
        const method = entry.stored ? 0 : 8;
        const compressed = entry.compressed ?? (entry.stored ? data : deflateRawSync(data));
        const uncompressedSize = entry.uncompressedSize ?? data.length;
        // yauzl never checks the CRC, so crafted entries keep the one of `data`.
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(uncompressedSize, 22);
        local.writeUInt16LE(name.length, 26);
        localParts.push(local, name, compressed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6); // version needed
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(uncompressedSize, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += local.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, centralDirectory, end]);
}
