import { describe, expect, it } from 'vitest';
import { asksForAccessCode } from './session.js';

describe('asksForAccessCode', () => {
    it('asks for the code when a write is refused for want of a session', () => {
        expect(asksForAccessCode(401, '/api/bottles', { method: 'POST' })).toBe(true);
        expect(asksForAccessCode(401, new Request('http://cave.lan/wines?/updateBottle'))).toBe(
            true
        );
        // As enhance sends a form action
        expect(
            asksForAccessCode(401, new URL('http://cave.lan/wines?/createBottles'), {
                method: 'post'
            })
        ).toBe(true);
        expect(asksForAccessCode(401, '/api/admin/images')).toBe(true);
    });

    it('leaves the logout alone, whose session may already have ended', () => {
        expect(asksForAccessCode(401, '/api/session', { method: 'delete' })).toBe(false);
        expect(
            asksForAccessCode(401, new Request('http://cave.lan/api/session', { method: 'DELETE' }))
        ).toBe(false);
    });

    it('ignores any other answer', () => {
        expect(asksForAccessCode(403, '/api/bottles', { method: 'POST' })).toBe(false);
        expect(asksForAccessCode(200, '/api/session', { method: 'DELETE' })).toBe(false);
    });
});
