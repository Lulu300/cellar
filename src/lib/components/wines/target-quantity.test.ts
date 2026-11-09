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

beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated = true;
    toasts.items = [];
    requests = [];
    putStatus = 200;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit = {}) => {
            const method = init.method ?? 'GET';
            requests.push({ method, url, body: init.body && JSON.parse(init.body as string) });
            if (method === 'GET') return Response.json(WINE);
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
        await removeTargetQuantity(WINE);

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

    it('says a refusal and keeps the page in step', async () => {
        putStatus = 422;

        await removeTargetQuantity(WINE);

        expect(toasts.items).toMatchObject([{ type: 'error' }]);
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it('asks a visitor to log in and sends nothing', async () => {
        auth.isAuthenticated = false;

        await removeTargetQuantity(WINE);

        expect(requests).toEqual([]);
        expect(toasts.items).toMatchObject([
            { type: 'warning', message: 'Please log in to remove a target quantity' }
        ]);
        expect(invalidate).not.toHaveBeenCalled();
    });
});
