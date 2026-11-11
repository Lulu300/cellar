import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '#lib/server/db/connection.js';
import { csvImportChoices } from '#lib/server/db/schema.js';

/**
 * A choice of a review as it is kept for the next imports: the row that a reference or the bottles
 * of a wine were given, by id so that a row renamed since is still found, or the text of a cell.
 */
const keptSchema = z.union([z.object({ id: z.string() }), z.object({ value: z.string() })]);
export type KeptChoice = z.output<typeof keptSchema>;

/** The choices kept for the problems `keys`, by key; one that cannot be read is left out. */
export function keptChoices(tx: Tx, keys: string[]): Map<string, KeptChoice> {
    if (keys.length === 0) return new Map();
    const rows = tx
        .select()
        .from(csvImportChoices)
        .where(inArray(csvImportChoices.key, keys))
        .all();
    return new Map(
        rows.flatMap(({ key, answer }) => {
            const kept = keptSchema.safeParse(JSON.parse(answer));
            return kept.success ? [[key, kept.data] as const] : [];
        })
    );
}

/** Keeps the choices of an import, each replacing the one kept for its problem, if any. */
export function keepChoices(tx: Tx, choices: { key: string; kept: KeptChoice }[]): void {
    for (const { key, kept } of choices) {
        const answer = JSON.stringify(kept);
        tx.insert(csvImportChoices)
            .values({ key, answer })
            .onConflictDoUpdate({
                target: csvImportChoices.key,
                set: { answer, updatedAt: new Date() }
            })
            .run();
    }
}
