import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { listWines } from '#lib/server/features/catalog/service.js';
import {
    dropUnusedImages,
    imageUrlsById,
    removeImageFiles
} from '#lib/server/features/images/service.js';
import { ConflictError, NotFoundError } from '#lib/server/http/errors.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { WishInput } from '#lib/shared/schemas/wish.js';
import {
    countWishes,
    deleteWish,
    getWish,
    insertWish,
    listWishRows,
    updateWish,
    wishedWines,
    wishOfWine
} from './repository';

type ListedWine = ReturnType<typeof listWines>[number];

/** The wine of a wish as the wishlist shows it, with its bottles in the cellar. */
function wishedWine({ definition, bottles }: ListedWine, imageUrls: Map<string, string>) {
    return {
        id: definition.id,
        name: definition.name,
        producer: definition.producer,
        color: definition.color,
        type: definition.type,
        appellation: definition.appellationName,
        region: definition.region,
        country: definition.country,
        imageUrl: (definition.imageId && imageUrls.get(definition.imageId)) || null,
        inCellar: bottles.filter((bottle) => bottle.availability === BottleAvailability.AVAILABLE)
            .length
    };
}

/** The wishes, the newest first, each with its photo or its wine. */
export function listWishes() {
    const imageUrls = imageUrlsById();
    const wines = new Map(listWines({ ownedOnly: true }).map((wine) => [wine.definition.id, wine]));
    return listWishRows().map((wish) => {
        const wine = wish.definitionId ? wines.get(wish.definitionId) : undefined;
        return {
            id: wish.id,
            text: wish.text,
            imageId: wish.imageId,
            imageUrl: (wish.imageId && imageUrls.get(wish.imageId)) || null,
            quantity: wish.quantity,
            note: wish.note,
            wine: wine ? wishedWine(wine, imageUrls) : null,
            createdAt: wish.createdAt,
            updatedAt: wish.updatedAt
        };
    });
}

const wishNotFound = () => new NotFoundError('Wish not found');

/** The wish as the wishlist lists it. */
function listedWish(id: string) {
    const wish = listWishes().find((listed) => listed.id === id);
    if (!wish) throw wishNotFound();
    return wish;
}

/** Refuses a second wish for a wine: a wine is on the wishlist once. */
function assertNotWished(input: WishInput, tx: Tx, wishId?: string) {
    if (!input.definitionId) return;
    const wish = wishOfWine(input.definitionId, tx);
    if (wish && wish.id !== wishId) {
        throw new ConflictError('duplicate_wish', 'This wine is already on the wishlist', {
            wishId: wish.id
        });
    }
}

/**
 * Runs `write`, which returns the photo that the wish no longer has, then deletes that photo unless
 * a wine or another wish uses it, as the wine that a text wish became does.
 */
async function writeWish(write: (tx: Tx) => string | null): Promise<void> {
    const dropped = db.transaction((tx) => {
        const formerImageId = write(tx);
        return formerImageId ? dropUnusedImages([formerImageId], tx) : [];
    });
    await removeImageFiles(dropped);
}

/** Adds a wish: a wine, at most once, or a text with a photo if wanted. */
export function createWish(input: WishInput) {
    const wish = db.transaction((tx) => {
        assertNotWished(input, tx);
        return insertWish(input, tx);
    });
    return listedWish(wish.id);
}

/**
 * Replaces every field of the wish. A text wish whose wine was created takes `definitionId` in
 * place of its text and photo, which the wine took as its main photo: a photo that nothing uses
 * any more is deleted.
 */
export async function replaceWish(id: string, input: WishInput) {
    await writeWish((tx) => {
        const former = getWish(id, tx);
        if (!former) throw wishNotFound();
        assertNotWished(input, tx, id);
        updateWish(id, input, tx);
        return former.imageId === input.imageId ? null : former.imageId;
    });
    return listedWish(id);
}

/** Changes the quantity or the note of the wish, and leaves its wine or text and photo as they are. */
export function changeWish(id: string, changes: Partial<Pick<WishInput, 'quantity' | 'note'>>) {
    if (!updateWish(id, changes, db)) throw wishNotFound();
    return listedWish(id);
}

/** Removes the wish from the wishlist, with its photo unless a wine uses it. */
export async function removeWish(id: string): Promise<void> {
    await writeWish((tx) => {
        const deleted = deleteWish(id, tx);
        if (!deleted) throw wishNotFound();
        return deleted.imageId;
    });
}

/**
 * What the menu and the wine pages need on every page: how many wishes there are, and the wish
 * of each wine on the wishlist, by the id of the wine.
 */
export function wishlistSummary() {
    return {
        wishCount: countWishes(),
        wishedWines: Object.fromEntries(
            wishedWines().map(({ definitionId, wishId }) => [definitionId, wishId])
        ) as Record<string, string>
    };
}
