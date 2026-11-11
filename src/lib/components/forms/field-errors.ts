import { m } from '#lib/paraglide/messages.js';
import { z } from 'zod';
import type { ApiErrorCode, ApiErrorIssue } from '#lib/shared/api-error.js';
import { apiErrorCode, apiErrorMessage } from '#lib/utils/api-error.js';
import { formatNumber } from '#lib/utils/format.js';

/** The message to show under each field of a form that a check refused, by field name. */
export type FieldErrors = Record<string, string>;

/** The field that the error body of each of these codes is about. */
const FIELD_OF_CODE: Partial<Record<ApiErrorCode, string>> = {
    duplicate_name: 'name',
    duplicate_barcode: 'barcode',
    barcode_for_one_bottle: 'barcode',
    barcode_range: 'barcode',
    barcode_out_of_range: 'barcode',
    barcode_not_encodable: 'barcode',
    barcode_prefix_too_long: 'barcode',
    case_full: 'storageCaseId',
    window_ends_before_start: 'drinkFrom'
};

/** The field that a path names: `grapeVarieties.2` is about `grapeVarieties`. */
const fieldOf = (path: string | PropertyKey[]) =>
    String(Array.isArray(path) ? path[0] : path).split('.')[0];

/** The number schema under the wrappers of a field's schema (nullish, default, transform). */
function numberSchema(schema: z.core.$ZodType | undefined): z.ZodNumber | undefined {
    if (schema instanceof z.ZodNumber) return schema;
    if (schema instanceof z.ZodPipe) return numberSchema(schema.in);
    if (
        schema instanceof z.ZodOptional ||
        schema instanceof z.ZodNullable ||
        schema instanceof z.ZodDefault
    ) {
        return numberSchema(schema.unwrap());
    }
    return undefined;
}

/** A bound that the schema sets: `z.int()` alone bounds a number to the safe integers. */
const isBound = (bound: number | null): bound is number =>
    bound !== null && Math.abs(bound) < Number.MAX_SAFE_INTEGER;

/**
 * What a number field expects, said whatever its issue (text, a fraction for a whole number, out
 * of range): with its range when its schema has one. Undefined for an issue that says its own
 * bound better, such as "Enter 0 or more" for a field with no maximum.
 */
function numberMessage(issue: z.core.$ZodIssue, number: z.ZodNumber): string | undefined {
    const { minValue, maxValue } = number;
    if (isBound(minValue) && isBound(maxValue)) {
        const range = { min: formatNumber(minValue), max: formatNumber(maxValue) };
        // `z.int()` has the format "safeint"
        if (number.format?.includes('int')) return m['form_errors.whole_number_between'](range);
        // `positive()` refuses its minimum itself, such as a label 0 mm wide.
        return 'exclusiveMinimum' in z.toJSONSchema(number)
            ? m['form_errors.number_above_up_to'](range)
            : m['form_errors.number_between'](range);
    }
    // "1.5" is a number, but not a whole one: say so even without a maximum.
    if (number.format?.includes('int') && isBound(minValue)) {
        return m['form_errors.whole_number_from']({ min: formatNumber(minValue) });
    }
    return issue.code === 'invalid_type' ? m['form_errors.number']() : undefined;
}

function issueMessage(issue: z.core.$ZodIssue, number?: z.ZodNumber): string {
    const message = number && numberMessage(issue, number);
    if (message) return message;
    switch (issue.code) {
        case 'too_small':
            // The schemas require a text by asking for one character at least.
            return issue.origin === 'string' && Number(issue.minimum) <= 1
                ? m['form_errors.required']()
                : m['form_errors.too_small']({ minimum: formatNumber(Number(issue.minimum)) });
        case 'too_big':
            return issue.origin === 'string'
                ? m['form_errors.too_long']({ maximum: formatNumber(Number(issue.maximum)) })
                : m['form_errors.too_big']({ maximum: formatNumber(Number(issue.maximum)) });
        default:
            return m['form_errors.invalid']();
    }
}

/**
 * The message of each field that a failed check of `schema` names: that of its first issue. A
 * number field says that it expects a number, and in which range. `keyOf` names the field of a
 * path, such as one item of a list: by default, the property of the schema.
 */
export function issueErrors(
    issues: readonly z.core.$ZodIssue[],
    schema: z.ZodType,
    keyOf: (path: PropertyKey[]) => string = fieldOf
): FieldErrors {
    const shape = schema instanceof z.ZodObject ? schema.shape : {};
    const errors: FieldErrors = {};
    for (const issue of issues) {
        errors[keyOf(issue.path)] ??= issueMessage(issue, numberSchema(shape[fieldOf(issue.path)]));
    }
    return errors;
}

/**
 * The fields that a refusal of the server names: those of the issues of a 422, the barcode of a
 * barcode refused, the case of a case that is full. Other refusals name no field.
 */
export function refusalErrors(body: unknown): FieldErrors {
    const code = apiErrorCode(body);
    if (!code) return {};
    const field = FIELD_OF_CODE[code];
    if (field) return { [field]: apiErrorMessage(body) };
    const details = (body as { error: { details?: unknown } }).error.details;
    if (code !== 'invalid_body' || !Array.isArray(details)) return {};
    // The issues of the server are in English: each field gets the general message.
    const invalid = m['form_errors.invalid']();
    return Object.fromEntries(
        (details as ApiErrorIssue[]).map(({ path }) => [fieldOf(path), invalid])
    );
}
