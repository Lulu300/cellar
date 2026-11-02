import { count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { namingMissingReferences } from '#lib/server/db-errors.js';
import { wishes, type Wish } from '#lib/server/db/schema.js';
import type { WishInput } from '#lib/shared/schemas/wish.js';

/** The wishes, the newest first. */
export function listWishRows(): Wish[] {
    return db
        .select()
        .from(wishes)
        .orderBy(desc(wishes.createdAt), desc(sql`${wishes}.rowid`))
        .all();
}

export function getWish(id: string, tx: Tx = db): Wish | undefined {
    return tx.select().from(wishes).where(eq(wishes.id, id)).get();
}

/** The wish of a wine, if it is on the wishlist. */
export function wishOfWine(definitionId: string, tx: Tx = db): Wish | undefined {
    return tx.select().from(wishes).where(eq(wishes.definitionId, definitionId)).get();
}

export function countWishes(): number {
    return db.select({ count: count() }).from(wishes).get()?.count ?? 0;
}

/** The wines on the wishlist, each with the id of its wish. */
export function wishedWines(): { definitionId: string; wishId: string }[] {
    return db
        .select({ definitionId: sql<string>`${wishes.definitionId}`, wishId: wishes.id })
        .from(wishes)
        .where(isNotNull(wishes.definitionId))
        .all();
}

export function insertWish(data: WishInput, tx: Tx): Wish {
    return namingMissingReferences(wishes, data, tx, () =>
        tx.insert(wishes).values(data).returning().get()
    );
}

/** Replaces the fields of the wish; undefined when there is no such wish. */
export function updateWish(id: string, data: Partial<WishInput>, tx: Tx): Wish | undefined {
    return namingMissingReferences(wishes, data, tx, () =>
        tx
            .update(wishes)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(wishes.id, id))
            .returning()
            .get()
    );
}

/** Returns the wish deleted, or undefined when there was none. */
export function deleteWish(id: string, tx: Tx): Wish | undefined {
    return tx.delete(wishes).where(eq(wishes.id, id)).returning().get();
}
