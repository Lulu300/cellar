import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../../test/event';
import { assertMcpWrite, isMcpRequest } from './token';

describe('isMcpRequest', () => {
    it.each([
        ['/mcp', true],
        ['/mcp/[...rest]', true],
        ['/mcpx', false],
        ['/api/mcp', false],
        [null, false]
    ])('route %s: %s', (routeId, expected) => {
        expect(isMcpRequest(fakeEvent({ routeId }))).toBe(expected);
    });
});

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
