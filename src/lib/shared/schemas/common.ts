import { z } from 'zod';

/** The id of a row, as the API returns it. */
export const id = z.string().trim().min(1).max(100);

/**
 * At most `max` characters, as every text of the app counts them: in UTF-16 units, an emoji two,
 * as `.length`, an input's `maxlength` and the imports count. zod's `.max()` counts an emoji as one,
 * so a text it took could not be saved again from the forms or come back whole from a CSV export.
 * Null counts as empty.
 */
export function maxLength(max: number) {
    const check = z.check<string | null>((context) => {
        if ((context.value?.length ?? 0) <= max) return;
        context.issues.push({
            code: 'too_big',
            origin: 'string',
            maximum: max,
            inclusive: true,
            input: context.value
        });
    });
    // A custom check says nothing to z.toJSONSchema, which reads the maximum that zod's own checks
    // leave in the bag of their schema: the OpenAPI description gives the limit this way.
    check._zod.onattach.push((schema) => {
        schema._zod.bag.maximum = max;
    });
    return check;
}

/** The most characters of a name, and of a producer. */
export const NAME_MAX_LENGTH = 500;

/** The name of an entity: required, and stored trimmed. */
export const name = z.string().trim().min(1).check(maxLength(NAME_MAX_LENGTH));

/**
 * The most characters of a note or a description: a size for people to write, not only a guard
 * against abuse (DATA-10). The forms say it and stop there; the API refuses more. Migration 0011
 * cut the longer texts that earlier versions stored, and the imports cut those of older files.
 */
export const LONG_TEXT_MAX_LENGTH = 5_000;

/** Free text that may be left empty, stored as null then. */
export function optionalText(max: number) {
    return z
        .string()
        .trim()
        .check(maxLength(max))
        .nullish()
        .transform((text) => text || null);
}

/** An optional id: null, empty or left out when there is none, as forms send it. */
export const optionalId = z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((value) => value || null);

/** A date the client may leave empty: a date string or timestamp, read as a Date, or null. */
export const optionalDate = z
    .union([z.string().max(100), z.number()])
    .nullish()
    .transform((value, context) => {
        if (value === null || value === undefined || value === '') return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            context.addIssue({ code: 'custom', message: 'Invalid date' });
            return z.NEVER;
        }
        return date;
    });

/**
 * A note or a description as it is stored and measured: with LF line breaks, which a browser sends
 * and the forms of earlier versions stored as CRLF, and trimmed. The API and the imports measure
 * the same text this way.
 */
export function asLongText(text: string): string {
    return text.replaceAll('\r\n', '\n').trim();
}

/**
 * A note or a description: free text of LONG_TEXT_MAX_LENGTH characters at most, stored as null
 * when empty. A line break is one character, stored as LF: a textarea counts it so against its
 * `maxlength`, but a browser sends it as CRLF, as the forms of earlier versions stored it.
 */
export const longText = z
    .string()
    .overwrite(asLongText)
    .check(maxLength(LONG_TEXT_MAX_LENGTH))
    .nullish()
    .transform((text) => text || null);
