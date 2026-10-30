import { describe, expect, it } from 'vitest';
import { filenameFromContentDisposition } from './content-disposition';

describe('filenameFromContentDisposition', () => {
    it('prefers filename* to the ASCII copy in filename', () => {
        expect(
            filenameFromContentDisposition(
                `attachment; filename="C_ur.zip"; filename*=UTF-8''C%C5%93ur%20%F0%9F%8D%B7.zip`
            )
        ).toBe('Cœur 🍷.zip');
    });

    it('reads filename* with a language tag, in any case', () => {
        expect(filenameFromContentDisposition(`attachment; FILENAME*=utf-8'fr'caf%C3%A9.csv`)).toBe(
            'café.csv'
        );
    });

    it('falls back to filename when filename* is malformed', () => {
        expect(
            filenameFromContentDisposition(
                `attachment; filename="plain.csv"; filename*=UTF-8''%E2%82`
            )
        ).toBe('plain.csv');
    });

    it('reads a quoted filename and unescapes it', () => {
        expect(filenameFromContentDisposition('attachment; filename="a \\"b\\".csv"')).toBe(
            'a "b".csv'
        );
    });

    it('does not read a parameter inside a quoted value', () => {
        expect(
            filenameFromContentDisposition(`attachment; filename="x filename*=UTF-8''evil.zip"`)
        ).toBe("x filename*=UTF-8''evil.zip");
    });

    it('reads an unquoted filename', () => {
        expect(filenameFromContentDisposition('attachment; filename=labels.pdf; size=3')).toBe(
            'labels.pdf'
        );
    });

    it.each([null, '', 'attachment', 'inline'])('returns null for %j', (header) => {
        expect(filenameFromContentDisposition(header)).toBeNull();
    });
});
