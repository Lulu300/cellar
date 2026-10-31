import { m } from '#lib/paraglide/messages.js';
import { API_ERROR_CODES, type ApiErrorBody, type ApiErrorCode } from '#lib/shared/api-error.js';
import { rowProblemsText } from '#lib/utils/import-problems.js';

function isApiErrorCode(code: unknown): code is ApiErrorCode {
    return (API_ERROR_CODES as readonly unknown[]).includes(code);
}

/** The code of an API error body, or undefined for any other body. */
export function apiErrorCode(body: unknown): ApiErrorCode | undefined {
    const code = (body as Partial<ApiErrorBody> | null)?.error?.code;
    return isApiErrorCode(code) ? code : undefined;
}

/**
 * A message of the catalogue. Each one takes its own values, which the `details` of an error body
 * hold: the server fills them, so they are not typed here.
 */
type ErrorMessage = (values: never) => string;

// Listed one by one, rather than built as `errors.${code}`, so that the type checker proves each
// code has a message and the bundler keeps only these messages.
const MESSAGES: Record<ApiErrorCode, ErrorMessage> = {
    malformed_body: m['errors.malformed_body'],
    body_too_large: m['errors.body_too_large'],
    invalid_body: m['errors.invalid_body'],
    not_found: m['errors.not_found'],
    method_not_allowed: m['errors.method_not_allowed'],
    missing_reference: m['errors.missing_reference'],
    in_use: m['errors.in_use'],
    duplicate_name: m['errors.duplicate_name'],
    duplicate_region: m['errors.duplicate_region'],
    duplicate_appellation: m['errors.duplicate_appellation'],
    duplicate_barcode: m['errors.duplicate_barcode'],
    barcode_for_one_bottle: m['errors.barcode_for_one_bottle'],
    notes_too_long: m['errors.notes_too_long'],
    case_holds_bottles: m['errors.case_holds_bottles'],
    case_full: m['errors.case_full'],
    duplicate_container: m['errors.duplicate_container'],
    duplicate_case: m['errors.duplicate_case'],
    container_changed: m['errors.container_changed'],
    barcode_range: m['errors.barcode_range'],
    barcode_out_of_range: m['errors.barcode_out_of_range'],
    invalid_barcode_prefix: m['errors.invalid_barcode_prefix'],
    barcode_prefix_required: m['errors.barcode_prefix_required'],
    barcode_not_encodable: m['errors.barcode_not_encodable'],
    barcode_prefix_too_long: m['errors.barcode_prefix_too_long'],
    label_too_small: m['errors.label_too_small'],
    labels_do_not_fit: m['errors.labels_do_not_fit'],
    barcode_generation_off: m['errors.barcode_generation_off'],
    invalid_file_name: m['errors.invalid_file_name'],
    nothing_to_export: m['errors.nothing_to_export'],
    invalid_backup: m['errors.invalid_backup'],
    invalid_export: m['errors.invalid_export'],
    export_refused: m['errors.export_refused'],
    pre_import_backup_failed: m['errors.pre_import_backup_failed'],
    import_row_refused: m['errors.import_row_refused'],
    backup_refused: m['errors.backup_refused'],
    pre_restore_backup_failed: m['errors.pre_restore_backup_failed'],
    wipe_failed: m['errors.wipe_failed'],
    image_unreadable: m['errors.image_unreadable'],
    cron_backups_disabled: m['errors.cron_backups_disabled'],
    unauthenticated: m['errors.unauthenticated'],
    cross_site_request: m['errors.cross_site_request'],
    wrong_access_code: m['errors.wrong_access_code'],
    wrong_setup_token: m['errors.wrong_setup_token'],
    access_code_already_set: m['errors.access_code_already_set'],
    too_many_attempts: m['errors.too_many_attempts'],
    writes_held: m['errors.writes_held'],
    internal_error: m['errors.internal_error']
};

/**
 * The messages of the variants of a code, and the field of `details` that names the variant: what
 * still uses a row, what is wrong with a backup or an export, why this version refuses one.
 */
const VARIANTS: Partial<
    Record<ApiErrorCode, { field: string; messages: Record<string, ErrorMessage> }>
> = {
    in_use: {
        field: 'usedBy',
        messages: {
            wine_definitions: m['errors.in_use_wine_definitions'],
            bottles: m['errors.in_use_bottles'],
            regions: m['errors.in_use_regions'],
            appellations: m['errors.in_use_appellations']
        }
    },
    invalid_backup: {
        field: 'problem',
        messages: {
            unreadable_zip: m['errors.invalid_backup_unreadable_zip'],
            no_database: m['errors.invalid_backup_no_database'],
            not_sqlite: m['errors.invalid_backup_not_sqlite'],
            damaged: m['errors.invalid_backup_damaged'],
            not_cellar: m['errors.invalid_backup_not_cellar'],
            no_migrations: m['errors.invalid_backup_no_migrations'],
            unknown_version: m['errors.invalid_backup_unknown_version']
        }
    },
    invalid_export: {
        field: 'problem',
        messages: {
            unreadable: m['errors.invalid_export_unreadable'],
            incomplete: m['errors.invalid_export_incomplete'],
            invalid_row: m['errors.invalid_export_invalid_row']
        }
    },
    export_refused: {
        field: 'rule',
        messages: {
            duplicate_region: m['errors.export_refused_duplicate_region'],
            duplicate_appellation: m['errors.export_refused_duplicate_appellation'],
            duplicate_barcode: m['errors.export_refused_duplicate_barcode'],
            duplicate_container: m['errors.export_refused_duplicate_container'],
            duplicate_case: m['errors.export_refused_duplicate_case'],
            missing_reference: m['errors.export_refused_missing_reference']
        }
    },
    invalid_file_name: {
        field: 'kind',
        messages: {
            image: m['errors.invalid_file_name_image'],
            reserved: m['errors.invalid_file_name_reserved']
        }
    },
    backup_refused: {
        field: 'kind',
        messages: {
            newer: m['errors.backup_refused_newer'],
            mandatory_stop: m['errors.backup_refused_mandatory_stop']
        }
    }
};

/** A value of `details` as the messages of the catalogue take it. */
function messageValue(code: ApiErrorCode, name: string, value: unknown): unknown {
    // A select of the catalogue compares strings: a flag such as `fixable` must read 'true'.
    if (typeof value === 'boolean') return String(value);
    // What is wrong with a row of an export, as codes that the CSV import words too
    if (code === 'invalid_export' && name === 'problems' && Array.isArray(value))
        return rowProblemsText(value);
    return value;
}

/**
 * The message to show for an API error body, in the user's language. A body that is not one, such
 * as the text of a proxy error, gives the message of an unexpected error. The values of `details`
 * fill the translation, such as the versions that a refused backup comes from and needs.
 */
export function apiErrorMessage(body: unknown): string {
    const code = apiErrorCode(body) ?? 'internal_error';
    const details = code === 'internal_error' ? undefined : (body as ApiErrorBody).error.details;
    const values: Record<string, unknown> =
        details && typeof details === 'object' && !Array.isArray(details)
            ? Object.fromEntries(
                  Object.entries(details).map(([name, value]) => [
                      name,
                      messageValue(code, name, value)
                  ])
              )
            : {};
    const variants = VARIANTS[code];
    const variant = variants && values[variants.field];
    // Its own message when the UI knows the variant, the general one of the code otherwise.
    const message =
        variants && typeof variant === 'string' && Object.hasOwn(variants.messages, variant)
            ? variants.messages[variant]
            : MESSAGES[code];
    return message(values as never);
}

/** Reads the body of a failed response and returns the message to show for it. */
export async function responseErrorMessage(response: Response): Promise<string> {
    return apiErrorMessage(await response.json().catch(() => null));
}
