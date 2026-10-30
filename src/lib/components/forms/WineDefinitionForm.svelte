<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import { errorMessage } from '#lib/api/client.js';
    import { enhance } from '$app/forms';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { DialogFooter } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import type { ReferencesDTO, SavedDefinitionDTO, UploadedImageDTO } from '#lib/shared/dto.js';
    import { wineDefinitionSchema, wineFromForm } from '#lib/shared/schemas/wine.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { formatInputNumber } from '#lib/utils/format.js';
    import { FormAction } from './form-action.svelte.js';
    import { ImageUploads } from './image-uploads.js';
    import FormField from './FormField.svelte';
    import LongTextarea from './LongTextarea.svelte';
    import ImagePicker from './ImagePicker.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import { createReference } from './references.js';
    import type { WineFormSource } from './form-sources.js';

    /**
     * The fields of a wine, created from scratch or from `wine` (duplicated), or `wine` edited. It
     * starts from `wine` as it is when the dialog opens: the page data that a new reference
     * reloads does not reset it.
     */
    let {
        wine,
        duplicate,
        imageUrl,
        onSaved,
        onCancel
    }: {
        wine: WineFormSource | null;
        duplicate: boolean;
        /** The URL of the image of `wine`. */
        imageUrl?: string;
        /** The wine saved, and whether the user asked to add a bottle of it next. */
        onSaved: (definition: SavedDefinitionDTO, addBottle: boolean) => void;
        onCancel: () => void;
    } = $props();

    const formId = $props.id();
    const initial = untrack(() => wine);
    const editedId = untrack(() => (duplicate ? undefined : wine?.id));

    const references: ReferencesDTO = $derived(page.data.references);

    let appellationId = $state(initial?.appellationId ?? '');
    let typeId = $state(initial?.typeId ?? '');
    let colorId = $state(initial?.colorId ?? '');
    let classificationId = $state(initial?.classificationId ?? '');
    let imageId = $state(initial?.imageId ?? '');
    let imageFile = $state<File | null>(null);
    let previewUrl = $state(untrack(() => (initial?.imageId && imageUrl) || ''));

    const uploads = new ImageUploads();
    onDestroy(() => uploads.close());

    const save = new FormAction<{ definition: SavedDefinitionDTO }>({
        read: wineFromForm,
        schema: () => wineDefinitionSchema,
        beforeSend: uploadImage,
        onSaved: ({ definition }, submitter) => {
            uploads.saved(definition.imageId);
            onSaved(definition, (submitter as HTMLButtonElement | null)?.value === 'addBottle');
        },
        onSettled: () => uploads.endSave()
    });
    const errors = $derived(save.errors);

    /** Uploads the new image, whose id the form then sends; false once the server refused it. */
    async function uploadImage(form: FormData): Promise<boolean> {
        // FormAction runs this once a save starts, and onSettled once it has ended, sent or not
        uploads.startSave();
        if (!imageFile) return true;
        let uploaded: UploadedImageDTO;
        try {
            uploaded = await uploads.upload(imageFile);
        } catch (error) {
            toasts.add(errorMessage(error), 'error', 5000);
            return false;
        }
        // Stored now: a save that the server refuses sends it again without another upload.
        [imageId, previewUrl, imageFile] = [uploaded.imageId, uploaded.url, null];
        form.set('imageId', uploaded.imageId);
        return true;
    }

    const createType = (name: string) => createReference('/api/wine-types', { name });
    const createColor = (name: string) => createReference('/api/wine-colors', { name });
    const createClassification = (name: string) =>
        createReference('/api/wine-classifications', { name });
</script>

<form
    id={formId}
    method="POST"
    action={editedId ? '/wines?/updateWine' : '/wines?/createWine'}
    novalidate
    use:enhance={save.submit}
    oninput={save.forget}
    class="space-y-4 px-1"
>
    {#if editedId}
        <input type="hidden" name="id" value={editedId} />
    {/if}
    {#each initial?.grapeVarieties ?? [] as grape, index (index)}
        <input type="hidden" name="grapeVarieties" value={grape} />
    {/each}

    <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="{m['forms.wine_name']()} *" id="{formId}-name" error={errors.name}>
            <Input
                id="{formId}-name"
                name="name"
                value={initial?.name ?? ''}
                placeholder={m['placeholders.wine_name_example']()}
            />
        </FormField>
        <FormField label={m['common.producer']()} id="{formId}-producer" error={errors.producer}>
            <Input
                id="{formId}-producer"
                name="producer"
                value={initial?.producer ?? ''}
                placeholder={m['placeholders.producer_example']()}
            />
        </FormField>
    </div>

    <LocationPicker bind:appellationId error={errors.appellationId} />

    <div class="grid gap-4 sm:grid-cols-3">
        <FormField label="{m['common.type']()} *" error={errors.typeId}>
            <SearchableSelect
                name="typeId"
                bind:value={typeId}
                options={references.wineTypes}
                placeholder={m['forms.search_wine_types_placeholder']()}
                allowCreate
                onCreate={createType}
                valueField="id"
            />
        </FormField>
        <FormField label="{m['common.color']()} *" error={errors.colorId}>
            <SearchableSelect
                name="colorId"
                bind:value={colorId}
                options={references.wineColors}
                placeholder={m['forms.search_wine_colors_placeholder']()}
                allowCreate
                onCreate={createColor}
                valueField="id"
            />
        </FormField>
        <FormField label={m['common.classification']()} error={errors.classificationId}>
            <SearchableSelect
                name="classificationId"
                bind:value={classificationId}
                options={references.wineClassifications}
                placeholder={m['forms.search_classifications_placeholder']()}
                allowCreate
                onCreate={createClassification}
                valueField="id"
            />
        </FormField>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
        <FormField label={m['common.website']()} id="{formId}-website" error={errors.website}>
            <Input
                id="{formId}-website"
                name="website"
                type="url"
                value={initial?.website ?? ''}
                placeholder={m['placeholders.website_example']()}
            />
        </FormField>
        <FormField label={m['forms.rating_1_to_5']()} id="{formId}-rating" error={errors.rating}>
            <Input
                id="{formId}-rating"
                name="rating"
                type="text"
                inputmode="decimal"
                value={formatInputNumber(initial?.rating)}
                placeholder={m['placeholders.rating_example']()}
            />
        </FormField>
        <FormField
            label={m['forms.target_quantity']()}
            id="{formId}-target"
            error={errors.targetQuantity}
            hint={m['forms.desired_bottles_to_have']()}
        >
            <Input
                id="{formId}-target"
                name="targetQuantity"
                type="text"
                inputmode="decimal"
                value={formatInputNumber(initial?.targetQuantity)}
                placeholder={m['placeholders.target_quantity_example']()}
            />
        </FormField>
    </div>

    <FormField
        label={m['common.description']()}
        id="{formId}-description"
        error={errors.description}
    >
        <LongTextarea
            id="{formId}-description"
            name="description"
            value={initial?.description ?? ''}
            placeholder={m['forms.tasting_notes_awards']()}
            rows={3}
        />
    </FormField>

    <ImagePicker bind:imageId bind:file={imageFile} bind:previewUrl />
</form>

<DialogFooter class="gap-2">
    <Button type="button" variant="outline" onclick={onCancel}>{m['common.cancel']()}</Button>
    {#if !initial}
        <Button
            type="submit"
            form={formId}
            name="next"
            value="addBottle"
            variant="outline"
            disabled={save.pending !== null}
        >
            {save.pending === 'addBottle' ? m['forms.saving']() : m['forms.save_and_add_bottle']()}
        </Button>
    {/if}
    <Button type="submit" form={formId} disabled={save.pending !== null}>
        {#if save.pending === ''}
            {m['forms.saving']()}
        {:else if duplicate}
            {m['forms.duplicate_wine']()}
        {:else if editedId}
            {m['forms.update_wine']()}
        {:else}
            {m['forms.save_wine']()}
        {/if}
    </Button>
</DialogFooter>
