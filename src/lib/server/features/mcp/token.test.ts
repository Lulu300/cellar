import { describe, expect, it } from 'vitest';
import { assertMcpWrite } from './token';

describe('assertMcpWrite', () => {
    it('refuses a write tool to a read-only token, and says where to allow it', () => {
        expect(() => assertMcpWrite({ write: false })).toThrow(
            'This MCP token is read-only: changes can be allowed in Cellar, under Admin › Settings › MCP access.'
        );
    });

    it('lets a write tool run when the token may write', () => {
        expect(() => assertMcpWrite({ write: true })).not.toThrow();
    });
});
