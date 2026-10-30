import { describe, expect, it } from 'vitest';
import { safeUrl } from './url';

// The page of a wine links to its website with safeUrl: it guards the values already stored, such
// as those of an old backup restored, which the server would refuse today.
describe('safeUrl', () => {
    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['JAVASCRIPT: in capitals', 'JAVASCRIPT:alert(1)'],
        ['javascript: after spaces', '  javascript:alert(1)'],
        ['data:', 'data:text/html,<script>alert(1)</script>'],
        ['vbscript:', 'vbscript:msgbox(1)'],
        ['a relative URL', '/wines/1'],
        ['a URL without its scheme', '//example.com'],
        ['a bare domain', 'example.com'],
        ['only spaces', '   '],
        ['an empty string', '']
    ])('refuses %s', (_, value) => {
        expect(safeUrl(value)).toBeNull();
    });

    it('refuses a value that is not a string', () => {
        expect(safeUrl(null)).toBeNull();
        expect(safeUrl({ href: 'https://example.com' })).toBeNull();
    });

    it('returns an http or https URL, without the spaces around it', () => {
        expect(safeUrl('http://example.com/domaine')).toBe('http://example.com/domaine');
        expect(safeUrl('  HTTPS://Example.com/Domaine  ')).toBe('https://example.com/Domaine');
    });
});
