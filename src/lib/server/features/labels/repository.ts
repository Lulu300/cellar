import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { labelPresets, type LabelPreset, type NewLabelPreset } from '#lib/server/db/schema.js';

export type PresetLayout = Omit<NewLabelPreset, 'id' | 'createdAt' | 'updatedAt'>;

export function listPresets(): LabelPreset[] {
    return db.select().from(labelPresets).orderBy(labelPresets.name).all();
}

export function getPreset(id: string): LabelPreset | undefined {
    return db.select().from(labelPresets).where(eq(labelPresets.id, id)).get();
}

export function insertPreset(preset: PresetLayout): LabelPreset {
    return db.insert(labelPresets).values(preset).returning().get();
}

/** Replaces every field of the preset; undefined when there is no such preset. */
export function updatePreset(id: string, preset: PresetLayout): LabelPreset | undefined {
    return db
        .update(labelPresets)
        .set({ ...preset, updatedAt: new Date() })
        .where(eq(labelPresets.id, id))
        .returning()
        .get();
}

/** Returns whether there was such a preset. */
export function deletePreset(id: string): boolean {
    return db.delete(labelPresets).where(eq(labelPresets.id, id)).run().changes > 0;
}
