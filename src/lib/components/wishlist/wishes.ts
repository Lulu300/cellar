import { invalidate } from '$app/navigation';
import { errorMessage, request } from '#lib/api/client.js';
import type { ImageUploads } from '#lib/components/forms/image-uploads.js';
import { confirm } from '#lib/components/layout/confirm.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { Jsonified, WishDTO } from '#lib/shared/dto.js';
import type { WishInput } from '#lib/shared/schemas/wish.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/** A wish as the page data and the API give it, but its dates: Date objects in one, strings in the other. */
export type Wish = Omit<Jsonified<WishDTO>, 'createdAt' | 'updatedAt'>;

/** The fields of a wish as the API takes them: those left out are empty. */
export type WishFields = Partial<WishInput>;

/** Adds a wish; throws the ApiError of a refusal. */
export const addWish = (wish: WishFields) =>
    request<Wish>('/api/wishes', { method: 'POST', json: wish });

/** Replaces every field of a wish; throws the ApiError of a refusal. */
export const replaceWish = (id: string, wish: WishFields) =>
    request<Wish>(`/api/wishes/${encodeURIComponent(id)}`, { method: 'PUT', json: wish });

/**
 * Saves a wish with its photo, then reloads the pages and the menu: a new photo (`file`) is
 * uploaded first, then `save` sends the wish with the id of its photo. A photo uploaded for a save
 * that failed is deleted when the form closes (ImageUploads). Returns the wish saved, or null after
 * a refusal, which a toast says.
 */
export async function saveWithPhoto(
    uploads: ImageUploads,
    { file, imageId }: { file: File | null; imageId: string },
    save: (imageId: string | null) => Promise<Wish>
): Promise<Wish | null> {
    uploads.startSave();
    try {
        const photoId = file ? (await uploads.upload(file)).imageId : imageId || null;
        const wish = await save(photoId);
        uploads.saved(photoId);
        await invalidate(CELLAR);
        return wish;
    } catch (error) {
        toasts.add(errorMessage(error), 'error');
        return null;
    } finally {
        await uploads.endSave();
    }
}

/**
 * Removes a wish, then reloads the pages and the menu, saying so in a toast; a refusal is said
 * in a toast too. Returns whether it was removed.
 */
export async function removeWish(id: string): Promise<boolean> {
    try {
        await request(`/api/wishes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
        toasts.add(errorMessage(error), 'error');
        return false;
    }
    toasts.add(m['wishlist.removed'](), 'success');
    await invalidate(CELLAR);
    return true;
}

/**
 * Puts a wine on the wishlist, or takes off its wish (`wishId`), then reloads the pages and the
 * menu; a toast says which, or the refusal.
 */
export async function toggleWish(wineId: string, wishId: string | undefined): Promise<void> {
    try {
        if (wishId) {
            await removeWish(wishId);
        } else {
            await addWish({ definitionId: wineId });
            toasts.add(m['wishlist.added'](), 'success');
            await invalidate(CELLAR);
        }
    } catch (error) {
        toasts.add(errorMessage(error), 'error');
    }
}

/** Whether a save of the bottle dialog adds bottles: a new bottle or a copy, never an edit. */
export const addsBottles = (editing: boolean, duplicate: boolean) => !editing || duplicate;

/**
 * Offers to remove from the wishlist each of these wines that is on it, once bottles of them were
 * added: nothing leaves the list without the user's choice. `wishedWines` gives the wish of each
 * wine on the list, as the root layout loads it.
 */
export async function offerToRemoveBought(
    definitionIds: Iterable<string>,
    wishedWines: Record<string, string>
): Promise<void> {
    for (const definitionId of new Set(definitionIds)) {
        const wishId = wishedWines[definitionId];
        if (!wishId) continue;
        const remove = await confirm({
            message: m['wishlist.remove_bought'](),
            confirmLabel: m['wishlist.remove'](),
            cancelLabel: m['wishlist.keep']()
        });
        if (remove) await removeWish(wishId);
    }
}
