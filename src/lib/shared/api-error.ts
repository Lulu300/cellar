/**
 * The codes the API puts in its error bodies. The UI translates each one (`errors.<code>` in
 * the locale files), so the list is closed: a new code needs its two translations.
 */
export const API_ERROR_CODES = [
    'malformed_body',
    'body_too_large',
    'invalid_body',
    'not_found',
    'method_not_allowed',
    'missing_reference',
    'in_use',
    'merge_choice_needed',
    'duplicate_name',
    'duplicate_region',
    'duplicate_appellation',
    'duplicate_barcode',
    'duplicate_wish',
    'barcode_for_one_bottle',
    'notes_too_long',
    'window_ends_before_start',
    'case_holds_bottles',
    'case_full',
    'duplicate_container',
    'duplicate_case',
    'container_changed',
    'barcode_range',
    'barcode_out_of_range',
    'invalid_barcode_prefix',
    'barcode_prefix_required',
    'barcode_not_encodable',
    'barcode_prefix_too_long',
    'label_too_small',
    'labels_do_not_fit',
    'barcode_generation_off',
    'invalid_file_name',
    'nothing_to_export',
    'invalid_backup',
    'invalid_export',
    'export_refused',
    'pre_import_backup_failed',
    'import_row_refused',
    'backup_refused',
    'pre_restore_backup_failed',
    'wipe_failed',
    'image_unreadable',
    'cron_backups_disabled',
    'unauthenticated',
    'cross_site_request',
    'wrong_access_code',
    'wrong_setup_token',
    'access_code_already_set',
    'too_many_attempts',
    'writes_held',
    'internal_error'
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** One rule of the request body that the value broke, as zod reports it. */
export interface ApiErrorIssue {
    /** The field, as a dotted path (`cases.2`); empty for the body itself. */
    path: string;
    message: string;
}

/** The body of every error answer of the API. */
export interface ApiErrorBody {
    error: {
        code: ApiErrorCode;
        /** In English, for logs and scripts; the UI shows the translation of `code`. */
        message: string;
        details?: unknown;
    };
}
