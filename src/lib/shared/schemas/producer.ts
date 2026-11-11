import { z } from 'zod';
import { tidyName } from '#lib/shared/names.js';
import { id, longText, name, optionalId } from './common.js';
import { formTexts } from './form.js';
import { website } from './wine.js';

/**
 * A producer, as POST and PUT take it: only the name is required. A field left out of a PUT keeps
 * its value, and null or '' clears it. A region gives its country.
 */
export const producerSchema = z.object({
    // Stored with its blanks tidied, as producers are compared
    name: name.transform(tidyName),
    countryId: optionalId.optional(),
    regionId: optionalId.optional(),
    website: website.optional(),
    contact: longText.optional(),
    description: longText.optional(),
    imageId: optionalId.optional()
});

export type ProducerInput = z.output<typeof producerSchema>;

/** The fields of a producer that a merge may take from the producer merged into the other. */
export const MERGED_FIELDS = ['place', 'website', 'contact', 'description', 'imageId'] as const;

export type MergedField = (typeof MERGED_FIELDS)[number];

/**
 * A merge: `mergedId` goes, its wines move to `keptId`. A field that both producers fill differently
 * needs a choice: `merged` takes the value of the producer merged, `kept` keeps the other. `place` is
 * the country and the region together.
 */
export const producerMergeSchema = z
    .object({
        keptId: id,
        mergedId: id,
        choices: z.partialRecord(z.enum(MERGED_FIELDS), z.enum(['kept', 'merged'])).default({})
    })
    .refine(({ keptId, mergedId }) => keptId !== mergedId, {
        path: ['mergedId'],
        message: 'A producer cannot be merged into itself'
    });

export type ProducerMerge = z.output<typeof producerMergeSchema>;

/** The producer of the producer form, for producerSchema to check: every field, '' for none. */
export const producerFromForm = (form: FormData) =>
    formTexts(form, [
        'name',
        'countryId',
        'regionId',
        'website',
        'contact',
        'description',
        'imageId'
    ]);
