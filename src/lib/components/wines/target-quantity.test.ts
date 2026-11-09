import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toasts } from '#lib/stores/toast.svelte.js';
import { removeTargetQuantity } from './target-quantity';

const { invalidate, auth } = vi.hoisted(() => ({
    invalidate: vi.fn(),
    auth: { isAuthenticated: true }
}));
vi.mock('$app/navigation', () => ({ invalidate }));
vi.mock('#lib/stores/auth.svelte.js', () => ({ auth }));

// The wine as GET /api/definitions/{id} answers it: references by id, and their names
const WINE = {
    id: 'w1',
    name: 'Château Cantemerle',
    producer: 'Château Cantemerle',
    appellationId: 'hm',
    typeId: 'still',
    colorId: 'red',
    classificationId: null,
    rating: 4,
    website: null,
    description: 'Haut-Médoc',
    imageId: 'label',
    grapeVarieties: ['Merlot'],
    targetQuantity: 6,
    appellation: { id: 'hm', name: 'Haut-Médoc' }
};

let requests: { method: string; url: string; body: unknown }[];
let putStatus: number;
let stored: typeof WINE | (Omit<typeof WINE, 'targetQuantity'> & { targetQuantity: null });

beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated = true;
    toasts.items = [];
    requests = [];
    putStatus = 200;
    stored = WINE;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit = {}) => {
            const method = init.method ?? 'GET';
            requests.push({ method, url, body: init.body && JSON.parse(init.body as string) });
            if (method === 'GET') return Response.json(stored);
            return putStatus === 200
                ? Response.json({})
                : Response.json(
                      { error: { code: 'validation_error', message: 'Name too long' } },
                      { status: putStatus }
                  );
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('removeTargetQuantity', () => {
    it('sends the wine back as it is now, without its target, and says which target went', async () => {
        expect(await removeTargetQuantity(WINE)).toBe(true);

        expect(requests).toEqual([
            { method: 'GET', url: '/api/definitions/w1', body: undefined },
            {
                method: 'PUT',
                url: '/api/definitions/w1',
                body: { ...WINE, targetQuantity: null }
            }
        ]);
        expect(toasts.items).toMatchObject([
            {
                type: 'success',
                message: 'Château Cantemerle: target quantity of 6 bottles removed'
            }
        ]);
        // The shortage list and the counters of the menu reload without a full reload.
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it('only reloads a wine whose target was already removed elsewhere', async () => {
        stored = { ...WINE, targetQuantity: null };

        expect(await removeTargetQuantity(WINE)).toBe(true);

        expect(requests.map(({ method }) => method)).toEqual(['GET']);
        expect(toasts.items).toEqual([]);
        expect(invalidate).toHaveBeenCalledOnce();
    });

    // A wine saved by an older version may hold a field the API now refuses: the PUT then
    // answers 422, and only the wine's form can correct it.
    it('sends the user to the wine form when the API refuses the wine as it is stored', async () => {
        putStatus = 422;

        expect(await removeTargetQuantity(WINE)).toBe(false);

        expect(toasts.items).toMatchObject([
            {
                type: 'error',
                message:
                    "Could not remove the target quantity of Château Cantemerle: one of its fields is no longer valid. Correct it in the wine's form."
            }
        ]);
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it('says any other refusal as the API gives it', async () => {
        putStatus = 409;

        expect(await removeTargetQuantity(WINE)).toBe(false);

        expect(toasts.items).toMatchObject([{ type: 'error' }]);
        expect(toasts.items[0].message).not.toContain("wine's form");
    });

    it('asks a visitor to log in and sends nothing', async () => {
        auth.isAuthenticated = false;

        expect(await removeTargetQuantity(WINE)).toBe(false);

        expect(requests).toEqual([]);
        expect(toasts.items).toMatchObject([
            { type: 'warning', message: 'Please log in to remove a target quantity' }
        ]);
        expect(invalidate).not.toHaveBeenCalled();
    });
});
