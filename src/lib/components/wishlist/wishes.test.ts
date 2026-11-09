import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageUploads } from '#lib/components/forms/image-uploads.js';
import { addsBottles, addWholeWish, offerToRemoveBought } from './wishes';

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

// A bottle edited was bought before: only new bottles and copies may take a wine off the list.
describe('addsBottles', () => {
    it('counts a new bottle and a copy, never an edit', () => {
        expect(addsBottles(false, false)).toBe(true);
        expect(addsBottles(true, true)).toBe(true);
        expect(addsBottles(true, false)).toBe(false);
    });
});

// The add form sends the whole wish at once: no edit afterwards for its note or quantity (UI-36).
describe('addWholeWish', () => {
    let posted: { url: string; body: unknown }[];
    const uploads = {
        startSave: vi.fn(),
        upload: vi.fn(async () => ({ imageId: 'photo-1' })),
        saved: vi.fn(),
        endSave: vi.fn()
    };
    const photo = new File(['label'], 'label.jpg', { type: 'image/jpeg' });

    beforeEach(() => {
        posted = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: RequestInit) => {
                posted.push({ url, body: JSON.parse(init.body as string) });
                return Response.json({ id: 'wish-1' }, { status: 201 });
            })
        );
    });

    it('sends a name with its photo, note and quantity in one request', async () => {
        const wish = await addWholeWish(uploads as unknown as ImageUploads, {
            wine: null,
            text: 'Puligny-Montrachet',
            file: photo,
            imageId: '',
            note: 'Seen at the fair',
            quantity: 2
        });

        expect(wish).toEqual({ id: 'wish-1' });
        expect(uploads.upload).toHaveBeenCalledWith(photo);
        expect(posted).toEqual([
            {
                url: '/api/wishes',
                body: {
                    text: 'Puligny-Montrachet',
                    imageId: 'photo-1',
                    note: 'Seen at the fair',
                    quantity: 2
                }
            }
        ]);
    });

    it('sends a wine of the cellar with its note and quantity, without the photo chosen for a name', async () => {
        await addWholeWish(uploads as unknown as ImageUploads, {
            wine: { id: 'wine-1' },
            text: 'chab',
            file: photo,
            imageId: '',
            note: 'The 2020 if possible',
            quantity: null
        });

        expect(uploads.upload).not.toHaveBeenCalled();
        expect(posted).toEqual([
            {
                url: '/api/wishes',
                body: { definitionId: 'wine-1', note: 'The 2020 if possible', quantity: null }
            }
        ]);
    });
});
