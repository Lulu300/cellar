import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { offerToRemoveBought } from './wishes';

const { invalidate, confirm } = vi.hoisted(() => ({ invalidate: vi.fn(), confirm: vi.fn() }));
vi.mock('$app/navigation', () => ({ invalidate }));
vi.mock('#lib/components/layout/confirm.svelte.js', () => ({ confirm }));

let deleted: string[];

beforeEach(() => {
    vi.clearAllMocks();
    deleted = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            deleted.push(url);
            return new Response(null, { status: 204 });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Nothing leaves the wishlist without the user's choice (decision FEAT-02).
describe('offerToRemoveBought', () => {
    it('asks once for each wine on the wishlist, and removes only those the user lets go', async () => {
        confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        await offerToRemoveBought(['kept', 'other', 'kept', 'gone', 'gone'], {
            kept: 'wish-kept',
            gone: 'wish-gone'
        });

        expect(confirm).toHaveBeenCalledTimes(2);
        expect(deleted).toEqual(['/api/wishes/wish-gone']);
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it('asks nothing for wines that are not on the wishlist', async () => {
        await offerToRemoveBought(['other'], { kept: 'wish-kept' });

        expect(confirm).not.toHaveBeenCalled();
        expect(deleted).toEqual([]);
    });
});
