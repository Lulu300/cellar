import { describe, expect, it } from 'vitest';
import { filenameFromContentDisposition } from '#lib/utils/content-disposition.js';
import { attachmentDisposition } from './content-disposition';

describe('attachmentDisposition', () => {
    it.each([
        [
            'an ASCII name',
            'cellar-backup-2026.zip',
            'cellar-backup-2026.zip',
            'cellar-backup-2026.zip'
        ],
        [
            'a Latin-1 name',
            'Château été.zip',
            'Ch_teau _t_.zip',
            'Ch%C3%A2teau%20%C3%A9t%C3%A9.zip'
        ],
        [
            'a name outside Latin-1',
            'Cœur de cave € 🍷.zip',
            'C_ur de cave _ _.zip',
            'C%C5%93ur%20de%20cave%20%E2%82%AC%20%F0%9F%8D%B7.zip'
        ],
        ['quotes and backslashes', 'a"b\\c.csv', 'a_b_c.csv', 'a%22b%5Cc.csv'],
        ['a percent sign', '100%25 sure.csv', '100_25 sure.csv', '100%2525%20sure.csv'],
        ['control characters', 'a\r\nb\t.csv', 'a__b_.csv', 'a%0D%0Ab%09.csv'],
        [
            'the characters RFC 8187 does not allow as is',
            "l'été (1)*.csv",
            "l'_t_ (1)*.csv",
            'l%27%C3%A9t%C3%A9%20%281%29%2A.csv'
        ]
    ])('encodes %s', (_, name, fallback, encoded) => {
        expect(attachmentDisposition(name)).toBe(
            `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
        );
    });

    it.each([
        'Cœur de cave € 🍷 "l\'été" (1).zip',
        "x filename*=UTF-8''evil.zip",
        '100% "sure"; filename=other.zip'
    ])('builds a value that a Response accepts and the client reads back as %j', (name) => {
        const response = new Response(null, {
            headers: { 'Content-Disposition': attachmentDisposition(name) }
        });

        expect(filenameFromContentDisposition(response.headers.get('Content-Disposition'))).toBe(
            name
        );
    });
});
