import { describe, expect, it } from 'vitest';
import { detectImageType } from './upload';

const bytes = (...values: (number | string)[]) =>
    Buffer.concat(
        values.map((value) =>
            typeof value === 'string' ? Buffer.from(value, 'latin1') : Buffer.from([value])
        )
    );

describe('detectImageType', () => {
    it.each([
        ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0), 'jpg', 'image/jpeg'],
        ['PNG', bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0, 0), 'png', 'image/png'],
        ['GIF87a', bytes('GIF87a'), 'gif', 'image/gif'],
        ['GIF89a', bytes('GIF89a'), 'gif', 'image/gif'],
        ['WebP', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'webp', 'image/webp']
    ])('recognises %s from its content', (_, content, extension, mimeType) => {
        expect(detectImageType(content)).toEqual({ extension, mimeType });
    });

    it.each([
        ['SVG, which can carry scripts', bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
        ['HEIC', bytes(0, 0, 0, 0x18, 'ftypheic')],
        ['a RIFF file that is not WebP', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ')],
        ['a truncated PNG signature', bytes(0x89, 'PNG')],
        ['HTML', bytes('<html><script>alert(1)</script>')],
        ['an empty file', bytes()]
    ])('refuses %s', (_, content) => {
        expect(detectImageType(content)).toBeNull();
    });
});
