import { z } from 'zod';
import { INVALID_WEBSITE_ERROR, isValidOptionalWebsite } from '#lib/utils/url.js';
import {
    id,
    longText,
    maxLength,
    name,
    NAME_MAX_LENGTH,
    optionalId,
    optionalText
} from './common.js';
import { formList, formNumbers, formTexts } from './form.js';

/** An http(s) URL, or null when left empty. */
const website = z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .refine(isValidOptionalWebsite, INVALID_WEBSITE_ERROR)
    .transform((url) => url || null);

/** A wine's rating: any number from 1 to 5, half points included (DATA-03). */
export const rating = z.number().min(1).max(5);

/** The most characters of a grape variety. */
export const GRAPE_MAX_LENGTH = 100;

/** A wine (its definition): every reference is an id. */
export const wineDefinitionSchema = z.object({
    name,
    producer: optionalText(NAME_MAX_LENGTH),
    appellationId: id,
    typeId: id,
    colorId: id,
    classificationId: optionalId,
    rating: rating.nullish().transform((rating) => rating ?? null),
    website,
    description: longText,
    imageId: optionalId,
    grapeVarieties: z
        .array(z.string().trim().min(1).check(maxLength(GRAPE_MAX_LENGTH)))
        .max(50)
        .default([]),
    targetQuantity: z
        .int()
        .min(0)
        .max(10000)
        .nullish()
        .transform((quantity) => quantity ?? null)
});

export type WineDefinitionInput = z.output<typeof wineDefinitionSchema>;

/** The wine of the wine form, for wineDefinitionSchema to check. */
export function wineFromForm(form: FormData) {
    return {
        ...formTexts(form, [
            'name',
            'producer',
            'appellationId',
            'typeId',
            'colorId',
            'classificationId',
            'website',
            'description',
            'imageId'
        ]),
        ...formNumbers(form, ['rating', 'targetQuantity']),
        grapeVarieties: formList(form, 'grapeVarieties')
    };
}
