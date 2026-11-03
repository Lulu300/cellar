<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { ApiError, errorMessage, request } from '#lib/api/client.js';
    import { enhance } from '$app/forms';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import ExistingBottleLocations from '#lib/components/forms/ExistingBottleLocations.svelte';
    import { availabilityLabel } from '#lib/components/bottles/availability.js';
    import DrinkBeforeFields from '#lib/components/bottles/DrinkBeforeFields.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { DialogFooter } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import LocaleDateInput from '#lib/components/forms/LocaleDateInput.svelte';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import type {
        BottleDTO,
        DefinitionDTO,
        Jsonified,
        NextBarcodeDTO,
        ReferencesDTO
    } from '#lib/shared/dto.js';
    import {
        bottleChangesSchema,
        bottleFromForm,
        newBottlesSchema
    } from '#lib/shared/schemas/bottle.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { FormAction } from './form-action.svelte.js';
    import FormField from './FormField.svelte';
    import LongTextarea from './LongTextarea.svelte';
    import { bottleFormValues, dropUnchanged, type BottleFormSource } from './form-sources.js';
    import { createReference } from './references.js';
    import StorageCasePicker from './StorageCasePicker.svelte';

    /**
     * The fields of a bottle: new ones, of the wine `definitionId` when given, a copy of `bottle`,
     * or `bottle` edited, of which it sends only the fields changed. It starts from its props as
     * they are when it mounts: the dialog mounts it again for each bottle.
     */
    let {
        bottle,
        duplicate,
        definitionId: chosenDefinitionId,
        onSaved,
        onCancel
    }: {
        bottle: BottleFormSource | null;
        duplicate: boolean;
        definitionId?: string;
        /** The bottles saved, and whether the user asked to add another one next. */
        onSaved: (bottles: BottleDTO[], addAnother: boolean) => void;
        onCancel: () => void;
    } = $props();

    const formId = $props.id();
    const editedId = untrack(() => (duplicate ? undefined : bottle?.id));
    const initial = untrack(() =>
        bottleFormValues(bottle, { copy: duplicate, definitionId: chosenDefinitionId })
    );

    const references: ReferencesDTO = $derived(page.data.references);

    let definitionId = $state(initial.definitionId);
    let originId = $state(initial.originId);
    let formatId = $state(initial.formatId);
    let storageCaseId = $state(initial.storageCaseId);
    // The case of the bottle edited, which it keeps when drunk without taking a place there: made
    // available again, it goes back to it, which the case field then shows chosen.
    const formerCase = untrack(() => (editedId ? bottle?.storageCase?.name : undefined));
    let availability = $state(initial.availability);
    let drinkBefore = $state(initial.drinkBefore);
    const consumed = $derived(availability === BottleAvailability.CONSUMED);

    let wines = $state<{ id: string; name: string }[]>([]);
    let winesLoading = $state(true);
    // Loaded for a new bottle only, empty when there is none to take (barcodes not automatic, or
    // refused). As on the server, only an available bottle takes it: one created consumed or out
    // of the cellar has no label to scan, but may be given a barcode by hand.
    let nextBarcode = $state('');
    let barcodeRefusal = $state('');
    const takesNextBarcode = $derived(
        !!nextBarcode && availability === BottleAvailability.AVAILABLE
    );
    // What the user typed, hidden while the field is disabled: a disabled field sends nothing.
    let typedBarcode = $state(initial.barcode);

    onMount(loadWines);

    // Loaded again after each login: when the session had expired, the last load got a 401.
    $effect(() => {
        if (!editedId && auth.isAuthenticated) untrack(loadNextBarcode);
    });

    async function loadWines() {
        try {
            const rows = await request<Jsonified<DefinitionDTO>[]>('/api/definitions');
            wines = rows.map(({ id, name, producer }) => ({
                id,
                name: producer ? `${name} - ${producer}` : name
            }));
        } catch {
            toasts.add(m['toast.failed_to_load_wine_definitions'](), 'error', 5000);
        } finally {
            winesLoading = false;
        }
    }

    // The next barcode needs a session, which the dialogs that add bottles have.
    async function loadNextBarcode() {
        barcodeRefusal = '';
        try {
            nextBarcode = (await request<NextBarcodeDTO>('/api/admin/next-barcode')).barcode;
        } catch (error) {
            nextBarcode = '';
            // 409 barcode_generation_off: the barcode is typed by hand. Any other refusal is said
            // now rather than at the save: 409 once the prefix has no number left, 401 once the
            // session has expired.
            if (!(error instanceof ApiError && error.code === 'barcode_generation_off')) {
                barcodeRefusal = errorMessage(error);
            }
        }
    }

    const save = new FormAction<{ bottles: BottleDTO[] }>({
        read: bottleFromForm,
        schema: () => (editedId ? bottleChangesSchema : newBottlesSchema),
        prepare: (form) => {
            if (editedId) dropUnchanged(form, initial);
        },
        onSaved: ({ bottles }, submitter) =>
            onSaved(bottles, (submitter as HTMLButtonElement | null)?.value === 'another')
    });
    const errors = $derived(save.errors);

    const createOrigin = (name: string) => createReference('/api/origins', { name });
    const createFormat = (name: string) => createReference('/api/wine-formats', { name });

    const availabilities = [
        BottleAvailability.AVAILABLE,
        BottleAvailability.OUT_OF_CELLAR,
        BottleAvailability.CONSUMED
    ];
</script>

<form
    id={formId}
    method="POST"
    action={editedId ? '/wines?/updateBottle' : '/wines?/createBottles'}
    novalidate
    use:enhance={save.submit}
    oninput={save.forget}
    class="space-y-4 px-1"
>
    {#if editedId}
        <input type="hidden" name="id" value={editedId} />
    {/if}

    <FormField label="{m['common.wine']()} *" error={errors.definitionId}>
        <SearchableSelect
            name="definitionId"
            bind:value={definitionId}
            options={wines}
            placeholder={m['wines.search_placeholder']()}
            isLoading={winesLoading}
            valueField="id"
            autoFocus={false}
        />
    </FormField>

    {#if !editedId && definitionId}
        <ExistingBottleLocations {definitionId} />
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
        <FormField label={m['forms.origin']()} error={errors.originId}>
            <SearchableSelect
                name="originId"
                bind:value={originId}
                options={references.origins}
                placeholder={m['forms.search_origins']()}
                allowCreate
                onCreate={createOrigin}
                valueField="id"
                autoFocus={false}
            />
        </FormField>
        <FormField label="{m['common.format']()} *" error={errors.formatId}>
            <SearchableSelect
                name="formatId"
                bind:value={formatId}
                options={references.wineFormats}
                placeholder={m['forms.search_formats']()}
                allowCreate
                onCreate={createFormat}
                valueField="id"
                autoFocus={false}
            />
        </FormField>
    </div>

    {#snippet number(name: string, label: string, placeholder: string)}
        <FormField {label} id="{formId}-{name}" error={errors[name]}>
            <Input
                id="{formId}-{name}"
                {name}
                type="text"
                inputmode="decimal"
                value={initial[name]}
                {placeholder}
            />
        </FormField>
    {/snippet}

    {#snippet date(name: string, label: string, disabled = false)}
        <FormField {label} id="{formId}-{name}" error={errors[name]}>
            <LocaleDateInput id="{formId}-{name}" {name} value={initial[name]} {disabled} />
        </FormField>
    {/snippet}

    <div class="grid gap-4 sm:grid-cols-2">
        {@render number('vintage', m['forms.vintage_year'](), m['placeholders.vintage_example']())}
        {@render number(
            'optimum',
            m['forms.optimum_drinking_year'](),
            m['placeholders.optimum_example']()
        )}
    </div>

    <div>
        <DrinkBeforeFields
            bind:value={drinkBefore}
            optional
            legend={m['drinking.drink_before']()}
        />
        <input type="hidden" name="drinkBefore" value={drinkBefore} />
        {#if errors.drinkBefore}
            <p class="mt-2 text-sm text-destructive">{errors.drinkBefore}</p>
        {/if}
    </div>

    {#if !editedId}
        <FormField
            label="{m['forms.number_of_bottles']()} *"
            id="{formId}-quantity"
            error={errors.quantity}
            hint={m['forms.each_bottle_separate_entry']()}
        >
            <Input
                id="{formId}-quantity"
                name="quantity"
                type="text"
                inputmode="decimal"
                value="1"
            />
        </FormField>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
        {@render number(
            'purchasePrice',
            m['forms.purchase_price'](),
            m['placeholders.amount_example']()
        )}
        {@render date('purchaseDate', m['common.purchase_date']())}
        {@render number(
            'currentValue',
            m['forms.current_value'](),
            m['placeholders.amount_example']()
        )}
        {@render date('currentValueDate', m['forms.value_date']())}
    </div>

    {#if consumed}
        <FormField label={m['forms.storage_case']()}>
            <p class="rounded-md border bg-muted/20 px-3 py-2 text-sm italic text-muted-foreground">
                {formerCase
                    ? m['bottle_form.consumed_former_case']({ caseName: formerCase })
                    : m['bottle_form.no_case_when_consumed']()}
            </p>
        </FormField>
    {:else}
        <StorageCasePicker bind:storageCaseId error={errors.storageCaseId} />
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
        <FormField label={m['forms.availability']()} id="{formId}-availability">
            <Select.Root type="single" name="availability" bind:value={availability}>
                <Select.Trigger id="{formId}-availability" class="w-full">
                    {availabilityLabel(availability)}
                </Select.Trigger>
                <Select.Content>
                    {#each availabilities as option (option)}
                        <Select.Item value={option} label={availabilityLabel(option)}>
                            {availabilityLabel(option)}
                        </Select.Item>
                    {/each}
                </Select.Content>
            </Select.Root>
        </FormField>
        {@render date('consumedDate', m['common.consumed_date'](), !consumed)}
    </div>

    <FormField
        label={takesNextBarcode
            ? `${m['common.barcode']()} (${m['forms.auto_generated']()})`
            : m['common.barcode']()}
        id="{formId}-barcode"
        error={errors.barcode ?? (barcodeRefusal || undefined)}
        hint={takesNextBarcode ? `${m['forms.next_barcode_will_be']()} ${nextBarcode}` : undefined}
    >
        <Input
            id="{formId}-barcode"
            name="barcode"
            bind:value={
                () => (takesNextBarcode ? '' : typedBarcode), (value) => (typedBarcode = value)
            }
            placeholder={takesNextBarcode
                ? nextBarcode
                : m['placeholders.enter_barcode_manually']()}
            disabled={takesNextBarcode}
            oninput={() => (barcodeRefusal = '')}
        />
    </FormField>

    <FormField label={m['common.notes']()} id="{formId}-notes" error={errors.notes}>
        <LongTextarea
            id="{formId}-notes"
            name="notes"
            value={initial.notes}
            placeholder={m['forms.tasting_notes_storage_conditions']()}
            rows={3}
        />
    </FormField>
</form>

<DialogFooter class="gap-2">
    <Button type="button" variant="outline" onclick={onCancel}>{m['common.cancel']()}</Button>
    {#if !bottle}
        <Button
            type="submit"
            form={formId}
            name="next"
            value="another"
            variant="outline"
            disabled={save.pending !== null}
        >
            {save.pending === 'another' ? m['forms.saving']() : m['forms.save_and_add_another']()}
        </Button>
    {/if}
    <Button type="submit" form={formId} disabled={save.pending !== null}>
        {#if save.pending === ''}
            {m['forms.saving']()}
        {:else if duplicate}
            {m['forms.duplicate_bottle']()}
        {:else if editedId}
            {m['forms.update_bottle']()}
        {:else}
            {m['forms.save_bottle']()}
        {/if}
    </Button>
</DialogFooter>
