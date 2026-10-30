import { beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import {
    bottleChangesSchema,
    bottleFromForm,
    newBottlesSchema
} from '#lib/shared/schemas/bottle.js';
import { wineDefinitionSchema, wineFromForm } from '#lib/shared/schemas/wine.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { plain, useLocale } from '../../../test/locale';
import { FormAction } from './form-action.svelte.js';

beforeEach(() => {
    toasts.items = [];
});

type Submit = FormAction<unknown>['submit'];
type Callback = (opts: { result: unknown }) => Promise<void>;

/** A field of the form that FormField marked in error. */
function fieldInError() {
    return { focus: vi.fn(), scrollIntoView: vi.fn() };
}

/**
 * Submits `fields` as the form would, through `use:enhance`. `firstInvalid` is what the form finds
 * under `[aria-invalid="true"]`, which FormField sets on the fields in error.
 */
async function submit(
    action: FormAction<unknown>,
    fields: Record<string, string>,
    value = '',
    firstInvalid: ReturnType<typeof fieldInError> | null = null
) {
    const formData = new FormData();
    for (const [name, field] of Object.entries(fields)) formData.set(name, field);
    const cancel = vi.fn();
    const submitter = { value } as unknown as HTMLElement;
    const formElement = { querySelector: vi.fn(() => firstInvalid) };
    const callback = (await (action.submit as Submit)({
        formElement,
        formData,
        cancel,
        submitter
    } as unknown as Parameters<Submit>[0])) as Callback | undefined;
    return { formData, cancel, callback, formElement };
}

const shownToasts = () => toasts.items.map(({ message }) => message);

function bottleAction(options: Partial<ConstructorParameters<typeof FormAction>[0]> = {}) {
    const onSaved = vi.fn();
    const action = new FormAction({
        read: bottleFromForm,
        schema: () => newBottlesSchema,
        onSaved,
        ...options
    });
    return { action, onSaved };
}

const bottle = { definitionId: 'margaux', formatId: 'bottle', quantity: '1' };

describe('FormAction', () => {
    it('sends nothing that the schema of the action refuses, and marks each field', async () => {
        const { action } = bottleAction();

        const { cancel, callback } = await submit(action, {
            ...bottle,
            formatId: '',
            vintage: 'x'
        });

        expect(cancel).toHaveBeenCalled();
        expect(callback).toBeUndefined();
        expect(action.errors).toEqual({
            formatId: m['form_errors.required'](),
            vintage: m['form_errors.whole_number_between']({ min: '0', max: '9,999' })
        });
        expect(shownToasts()).toEqual([m['errors.invalid_body']()]);
    });

    // Found after BUG-14: "This value is not valid." did not say that a number was expected.
    it('says under a number field that it expects a number, and in which range', async () => {
        const { action } = bottleAction();
        await submit(action, {
            ...bottle,
            quantity: '0',
            vintage: '2015,5',
            purchasePrice: '1e'
        });

        expect(action.errors).toEqual({
            quantity: m['form_errors.whole_number_between']({ min: '1', max: '100' }),
            vintage: m['form_errors.whole_number_between']({ min: '0', max: '9,999' }),
            purchasePrice: m['form_errors.number']()
        });

        const wine = new FormAction({
            read: wineFromForm,
            schema: () => wineDefinitionSchema,
            onSaved: vi.fn()
        });
        await submit(wine, {
            name: 'Margaux',
            appellationId: 'a',
            typeId: 't',
            colorId: 'c',
            rating: 'x'
        });
        expect(wine.errors).toEqual({
            rating: m['form_errors.number_between']({ min: '1', max: '5' })
        });

        // An edit sends only the fields changed: its schema wraps each field once more.
        const { action: edit } = bottleAction({ schema: () => bottleChangesSchema });
        await submit(edit, { vintage: '1e' });
        expect(edit.errors).toEqual({
            vintage: m['form_errors.whole_number_between']({ min: '0', max: '9,999' })
        });
    });

    // Decision "Negative prices (UI-06)": a price or a value is 0 or more.
    it('says under a price or a value that it is 0 or more', async () => {
        const { action } = bottleAction();
        await submit(action, { ...bottle, purchasePrice: '-5', currentValue: '-0,5' });

        expect(action.errors).toEqual({
            purchasePrice: m['form_errors.too_small']({ minimum: '0' }),
            currentValue: m['form_errors.too_small']({ minimum: '0' })
        });
    });

    it('writes the range in the language of the interface', async () => {
        useLocale('fr');
        const wine = new FormAction({
            read: wineFromForm,
            schema: () => wineDefinitionSchema,
            onSaved: vi.fn()
        });
        await submit(wine, { name: 'Margaux', targetQuantity: '1e' });

        expect(plain(wine.errors.targetQuantity)).toBe(
            'Saisissez un nombre entier entre 0 et 10 000.'
        );
    });

    it('says under a note or a description that is too long how many characters it takes', async () => {
        const { action } = bottleAction();
        await submit(action, { ...bottle, notes: 'x'.repeat(5_001) });
        const wine = new FormAction({
            read: wineFromForm,
            schema: () => wineDefinitionSchema,
            onSaved: vi.fn()
        });
        await submit(wine, {
            name: 'Margaux',
            appellationId: 'a',
            typeId: 't',
            colorId: 'c',
            description: 'x'.repeat(5_001)
        });

        const tooLong = m['form_errors.too_long']({ maximum: '5,000' });
        expect(action.errors).toEqual({ notes: tooLong });
        expect(wine.errors).toEqual({ description: tooLong });
    });

    it('checks the form once prepared, as the action receives it', async () => {
        const { action } = bottleAction({
            schema: () => bottleChangesSchema,
            prepare: (form) => form.delete('quantity')
        });

        const { cancel, formData } = await submit(action, bottle);

        expect(cancel).not.toHaveBeenCalled();
        expect(formData.has('quantity')).toBe(false);
    });

    it('gives what the action answered, with the button that sent the form', async () => {
        const { action, onSaved } = bottleAction();

        const { callback } = await submit(action, bottle, 'another');
        expect(action.pending).toBe('another');
        await callback!({ result: { type: 'success', status: 200, data: { bottles: [] } } });

        expect(onSaved).toHaveBeenCalledWith({ bottles: [] }, { value: 'another' });
        expect(action.pending).toBeNull();
    });

    // Found during BUG-01: the message of a prefix used up never reached the user.
    it('shows a barcode refused under the barcode field, and in a toast', async () => {
        const { action } = bottleAction();
        const { callback } = await submit(action, bottle);

        await callback!({
            result: {
                type: 'failure',
                status: 409,
                data: { error: { code: 'barcode_range', message: 'No number left' } }
            }
        });

        expect(action.errors).toEqual({ barcode: m['errors.barcode_range']() });
        expect(shownToasts()).toEqual([m['errors.barcode_range']()]);
    });

    // Found during API-01: only the barcode was marked.
    // Found during BUG-14: at 390 px, a refused save left the field in error out of sight.
    it('brings the first field in error into view and focuses it, after its own check', async () => {
        const { action } = bottleAction();
        const field = fieldInError();
        const { formElement } = await submit(action, { ...bottle, formatId: '' }, '', field);

        expect(formElement.querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
        expect(field.focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });

    it('brings the first field in error into view after a refusal of the server', async () => {
        const { action } = bottleAction();
        const field = fieldInError();
        const { callback } = await submit(action, bottle, '', field);
        expect(field.focus).not.toHaveBeenCalled();

        await callback!({
            result: {
                type: 'failure',
                status: 422,
                data: { error: { code: 'duplicate_barcode', message: 'Taken' } }
            }
        });

        expect(field.focus).toHaveBeenCalled();
        expect(field.scrollIntoView).toHaveBeenCalled();
    });

    it('marks each field that the details of a 422 name', async () => {
        const { action } = bottleAction();
        const { callback } = await submit(action, bottle);

        await callback!({
            result: {
                type: 'failure',
                status: 422,
                data: {
                    error: {
                        code: 'invalid_body',
                        message: 'Invalid',
                        details: [
                            { path: 'vintage', message: 'Too big' },
                            { path: 'notes', message: 'Too long' }
                        ]
                    }
                }
            }
        });

        expect(action.errors).toEqual({
            vintage: m['form_errors.invalid'](),
            notes: m['form_errors.invalid']()
        });
    });

    it('marks the case that has no room left', async () => {
        const { action } = bottleAction();
        const { callback } = await submit(action, bottle);
        const details = { caseName: 'A1', capacity: 1, bottles: 2 };

        await callback!({
            result: {
                type: 'failure',
                status: 409,
                data: { error: { code: 'case_full', message: 'Full', details } }
            }
        });

        expect(Object.keys(action.errors)).toEqual(['storageCaseId']);
    });

    it('tells a session that expired from the status of the refusal of the hooks', async () => {
        const { action } = bottleAction();
        const { callback } = await submit(action, bottle);

        const add = vi.spyOn(toasts, 'add');
        await callback!({
            result: { type: 'error', error: { status: 401, message: 'Unauthorized' } }
        });

        // The toasts leave it to the login dialog, which the layout opens on a 401.
        expect(add).toHaveBeenCalledWith(m['errors.unauthenticated'](), 'error', 5000);
    });

    it('sends nothing when the step before sending fails', async () => {
        const onSettled = vi.fn();
        const { action } = bottleAction({ beforeSend: async () => false, onSettled });

        const { cancel } = await submit(action, bottle);

        expect(cancel).toHaveBeenCalled();
        expect(action.pending).toBeNull();
        expect(onSettled).toHaveBeenCalledOnce();
    });

    it('tells once a save has ended, saved or refused, but not a form its own check refused', async () => {
        const onSettled = vi.fn();
        const { action } = bottleAction({ onSettled });

        await submit(action, { ...bottle, formatId: '' });
        expect(onSettled).not.toHaveBeenCalled();

        const saved = await submit(action, bottle);
        await saved.callback!({ result: { type: 'success', status: 200, data: { bottles: [] } } });
        const refused = await submit(action, bottle);
        await refused.callback!({
            result: { type: 'error', error: { status: 503, message: 'Writes held' } }
        });

        expect(onSettled).toHaveBeenCalledTimes(2);
    });

    it('forgets the error of a field once the user changes it', async () => {
        const { action } = bottleAction();
        await submit(action, { ...bottle, formatId: '', vintage: 'x' });

        action.forget({ target: { name: 'vintage' } } as unknown as Event);

        expect(Object.keys(action.errors)).toEqual(['formatId']);
    });
});
