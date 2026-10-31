import { z } from 'zod';
import { longText, NAME_MAX_LENGTH, optionalId, optionalText } from './common.js';

/**
 * A wish of the wishlist: a wine of the cellar (`definitionId`), or the name of a wine not in it
 * yet (`text`) with a photo if wanted (`imageId`), and for both an optional quantity and note.
 */
export const wishSchema = z
    .object({
        definitionId: optionalId,
        text: optionalText(NAME_MAX_LENGTH),
        imageId: optionalId,
        quantity: z
            .int()
            .min(1)
            .max(10000)
            .nullish()
            .transform((quantity) => quantity ?? null),
        note: longText
    })
    .refine(({ definitionId, text }) => (definitionId === null) !== (text === null), {
        message: 'Give either a wine (definitionId) or a text, not both',
        path: ['text']
    })
    // A wish for a wine shows the photos of that wine.
    .refine(({ definitionId, imageId }) => definitionId === null || imageId === null, {
        message: 'Only a wish with a text takes a photo',
        path: ['imageId']
    });

export type WishInput = z.output<typeof wishSchema>;
