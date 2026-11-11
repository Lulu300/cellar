<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import { enhance } from '$app/forms';
    import { page } from '$app/state';
    import { errorMessage } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { DialogFooter } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import ImagePicker from '#lib/components/forms/ImagePicker.svelte';
    import LongTextarea from '#lib/components/forms/LongTextarea.svelte';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import { FormAction } from '#lib/components/forms/form-action.svelte.js';
    import { ImageUploads } from '#lib/components/forms/image-uploads.js';
    import type { ProducerDTO, ReferencesDTO, UploadedImageDTO } from '#lib/shared/dto.js';
    import { producerFromForm, producerSchema } from '#lib/shared/schemas/producer.js';
    import { toasts } from '#lib/stores/toast.svelte.js';

    type Producer = Pick<
        ProducerDTO,
        'id' | 'name' | 'countryId' | 'regionId' | 'website' | 'contact' | 'description' | 'imageId'
    >;

    /** The fields of a producer, new or `producer` edited, as they are when the dialog opens. */
    let {
        producer,
        imageUrl,
        onSaved,
        onCancel
    }: {
        producer: Producer | null;
        /** The URL of the photo of `producer`. */
        imageUrl?: string;
        onSaved: (producer: ProducerDTO) => void;
        onCancel: () => void;
    } = $props();

    const formId = $props.id();
    const initial = untrack(() => producer);
    const references: ReferencesDTO = $derived(page.data.references);

    let countryId = $state(initial?.countryId ?? '');
    let regionId = $state(initial?.regionId ?? '');
    let imageId = $state(initial?.imageId ?? '');
    let imageFile = $state<File | null>(null);
    let previewUrl = $state(untrack(() => (initial?.imageId && imageUrl) || ''));

    // The regions of the country chosen; a region chosen first gives its country.
    const regions = $derived(
        countryId
            ? references.regions.filter((region) => region.countryId === countryId)
            : references.regions
    );
    $effect(() => {
        const region = references.regions.find((region) => region.id === regionId);
        if (region && region.countryId !== countryId) countryId = region.countryId;
    });
    $effect(() => {
        if (regionId && !regions.some((region) => region.id === regionId)) regionId = '';
    });

    const uploads = new ImageUploads();
    onDestroy(() => uploads.close());

    const save = new FormAction<{ producer: ProducerDTO }>({
        read: producerFromForm,
        schema: () => producerSchema,
        beforeSend: uploadImage,
        onSaved: ({ producer }) => {
            uploads.saved(producer.imageId);
            onSaved(producer);
        },
        onSettled: () => uploads.endSave()
    });
    const errors = $derived(save.errors);

    /** Uploads the new photo, whose id the form then sends; false once the server refused it. */
    async function uploadImage(form: FormData): Promise<boolean> {
        uploads.startSave();
        if (!imageFile) return true;
        let uploaded: UploadedImageDTO;
        try {
            uploaded = await uploads.upload(imageFile);
        } catch (error) {
            toasts.add(errorMessage(error), 'error', 5000);
            return false;
        }
        [imageId, previewUrl, imageFile] = [uploaded.imageId, uploaded.url, null];
        form.set('imageId', uploaded.imageId);
        return true;
    }
</script>

<form
    id={formId}
    method="POST"
    action={initial ? '/producers?/updateProducer' : '/producers?/createProducer'}
    novalidate
    use:enhance={save.submit}
    oninput={save.forget}
    class="space-y-4 px-1"
>
    {#if initial}
        <input type="hidden" name="id" value={initial.id} />
    {/if}

    <FormField label="{m['producers.name']()} *" id="{formId}-name" error={errors.name}>
        <Input
            id="{formId}-name"
            name="name"
            value={initial?.name ?? ''}
            placeholder={m['placeholders.producer_example']()}
        />
    </FormField>

    <div class="grid gap-4 sm:grid-cols-2">
        <FormField label={m['common.country']()} error={errors.countryId}>
            <SearchableSelect
                name="countryId"
                bind:value={countryId}
                options={references.countries}
                placeholder={m['placeholders.search_countries']()}
                valueField="id"
            />
        </FormField>
        <FormField label={m['common.region']()} error={errors.regionId}>
            <SearchableSelect
                name="regionId"
                bind:value={regionId}
                options={regions}
                placeholder={m['placeholders.search_regions']()}
                valueField="id"
            />
        </FormField>
    </div>

    <FormField label={m['common.website']()} id="{formId}-website" error={errors.website}>
        <Input
            id="{formId}-website"
            name="website"
            type="url"
            value={initial?.website ?? ''}
            placeholder={m['placeholders.website_example']()}
        />
    </FormField>

    <FormField label={m['producers.contact']()} id="{formId}-contact" error={errors.contact}>
        <LongTextarea
            id="{formId}-contact"
            name="contact"
            value={initial?.contact ?? ''}
            placeholder={m['producers.contact_placeholder']()}
            rows={3}
        />
    </FormField>

    <FormField
        label={m['common.description']()}
        id="{formId}-description"
        error={errors.description}
    >
        <LongTextarea
            id="{formId}-description"
            name="description"
            value={initial?.description ?? ''}
            placeholder={m['producers.description_placeholder']()}
            rows={4}
        />
    </FormField>

    <ImagePicker
        label={m['producers.photo']()}
        bind:imageId
        bind:file={imageFile}
        bind:previewUrl
    />
</form>

<DialogFooter class="gap-2">
    <Button type="button" variant="outline" onclick={onCancel}>{m['common.cancel']()}</Button>
    <Button type="submit" form={formId} disabled={save.pending !== null}>
        {save.pending === '' ? m['forms.saving']() : m['common.save']()}
    </Button>
</DialogFooter>
