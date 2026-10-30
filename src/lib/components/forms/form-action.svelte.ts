import type { SubmitFunction } from '$app/forms';
import { tick } from 'svelte';
import { m } from '#lib/paraglide/messages.js';
import type { z } from 'zod';
import type { ApiErrorCode } from '#lib/shared/api-error.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { apiErrorMessage } from '#lib/utils/api-error.js';
import { issueErrors, refusalErrors, type FieldErrors } from './field-errors.js';

/**
 * The refusals of hooks.server.ts, which come before any action runs: their body is an API error
 * that `enhance` cannot read, so only their status tells them apart.
 */
const CODE_OF_STATUS: Record<number, ApiErrorCode> = {
    401: 'unauthenticated',
    403: 'cross_site_request',
    413: 'body_too_large',
    503: 'writes_held'
};

interface FormActionOptions<Saved> {
    /** What the action reads from the form: the same reader as on the server. */
    read: (form: FormData) => unknown;
    /** The schema that the action checks it with. */
    schema: () => z.ZodType;
    /** Edits the form data before it is checked and sent, e.g. drops the fields left unchanged. */
    prepare?: (form: FormData) => void;
    /**
     * Runs once the check passed, before sending, e.g. to upload an image. It tells the user of
     * its own failures, and answers false to cancel.
     */
    beforeSend?: (form: FormData) => Promise<boolean>;
    /** Gets what the action answered, and the button that sent the form. */
    onSaved: (saved: Saved, submitter: HTMLElement | null) => void | Promise<void>;
    /** Runs once a save that passed the check has ended, saved or not, after onSaved. */
    onSettled?: () => void;
}

/**
 * Brings the first field in error into view and gives it the focus: in a long form, on a phone
 * above all, the field may be far from the button that was pressed. FormField marks the fields in
 * error with aria-invalid once the errors are rendered.
 */
async function showFirstError(form: HTMLFormElement) {
    await tick();
    const field = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: 'center' });
}

/**
 * Sends a form to its action with `use:enhance`, once the schema of the action accepts it, and
 * shows each refusal under the field it is about, with a toast: the dialog's own check, a 422 of
 * the server, a barcode or a case refused (UI-06).
 */
export class FormAction<Saved> {
    errors = $state<FieldErrors>({});
    /** The value of the button whose save is running ('' for one without), null while none is. */
    pending = $state<string | null>(null);

    constructor(private readonly options: FormActionOptions<Saved>) {}

    /** Forgets the error of a field once the user changes it: a form's `oninput`. */
    forget = (event: Event) => {
        const { name } = event.target as HTMLInputElement;
        if (name in this.errors) delete this.errors[name];
    };

    submit: SubmitFunction = async ({ formElement, formData, cancel, submitter }) => {
        const { read, schema, prepare, beforeSend, onSaved, onSettled } = this.options;
        prepare?.(formData);
        const checking = schema();
        const checked = checking.safeParse(read(formData));
        if (!checked.success) {
            cancel();
            this.errors = issueErrors(checked.error.issues, checking);
            toasts.add(m['errors.invalid_body'](), 'error', 5000);
            await showFirstError(formElement);
            return;
        }
        this.pending = (submitter as HTMLButtonElement | null)?.value ?? '';
        if (beforeSend && !(await beforeSend(formData))) {
            cancel();
            this.pending = null;
            onSettled?.();
            return;
        }
        return async ({ result }) => {
            this.pending = null;
            if (result.type === 'success') {
                this.errors = {};
                try {
                    await onSaved(result.data as Saved, submitter);
                } finally {
                    onSettled?.();
                }
                return;
            }
            // The actions never redirect; an error is a refusal of the hooks or a network failure.
            const status = result.type === 'error' ? result.error.status : result.status;
            const body =
                result.type === 'failure'
                    ? result.data
                    : { error: { code: CODE_OF_STATUS[status] ?? 'internal_error' } };
            this.errors = refusalErrors(body);
            toasts.add(apiErrorMessage(body), 'error', 5000);
            onSettled?.();
            await showFirstError(formElement);
        };
    };
}
