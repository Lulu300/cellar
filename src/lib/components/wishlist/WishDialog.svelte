<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import LongTextarea from '#lib/components/forms/LongTextarea.svelte';
    import { ImageUploads } from '#lib/components/forms/image-uploads.js';
    import PhotoField from '#lib/components/forms/PhotoField.svelte';
    import { NAME_MAX_LENGTH } from '#lib/shared/schemas/common.js';
    import { replaceWish, saveWithPhoto, type Wish } from './wishes.js';

    /** Changes a wish: its quantity and note, and the name and photo of a text wish. */
    let { wish, onClose }: { wish: Wish; onClose: () => void } = $props();

    const formId = $props.id();
    const initial = untrack(() => wish);
    let text = $state(initial.text ?? '');
    // A number input binds a number, or null once emptied
    let quantity = $state<number | null>(initial.quantity);
    let note = $state(initial.note ?? '');
    let imageId = $state(initial.imageId ?? '');
    let file = $state<File | null>(null);
    let previewUrl = $state(initial.imageUrl ?? '');
    let saving = $state(false);

    const uploads = new ImageUploads();
    onDestroy(() => uploads.close());

    async function save(event: SubmitEvent) {
        event.preventDefault();
        saving = true;
        const fields = { quantity: quantity ?? null, note };
        const saved = await saveWithPhoto(uploads, { file, imageId }, (photoId) =>
            replaceWish(
                initial.id,
                initial.wine
                    ? { ...fields, definitionId: initial.wine.id }
                    : { ...fields, text, imageId: photoId }
            )
        );
        saving = false;
        if (saved) onClose();
    }
</script>

<Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
            <DialogTitle>{m['wishlist.edit']()}</DialogTitle>
        </DialogHeader>
        <form id={formId} class="space-y-4 px-1" onsubmit={save}>
            {#if initial.wine}
                <p class="font-medium">{initial.wine.name}</p>
            {:else}
                <FormField label="{m['forms.wine_name']()} *" id="{formId}-text">
                    <Input
                        id="{formId}-text"
                        bind:value={text}
                        maxlength={NAME_MAX_LENGTH}
                        required
                    />
                </FormField>
            {/if}
            <FormField
                label={m['wishlist.quantity']()}
                id="{formId}-quantity"
                hint={m['wishlist.quantity_hint']()}
            >
                <Input
                    id="{formId}-quantity"
                    bind:value={quantity}
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    inputmode="numeric"
                />
            </FormField>
            <FormField label={m['common.notes']()} id="{formId}-note">
                <LongTextarea id="{formId}-note" bind:value={note} rows={3} />
            </FormField>
            {#if !initial.wine}
                <PhotoField label={m['wishlist.photo']()} bind:imageId bind:file bind:previewUrl />
            {/if}
        </form>
        <DialogFooter class="gap-2">
            <Button type="button" variant="outline" onclick={onClose}>{m['common.cancel']()}</Button
            >
            <Button type="submit" form={formId} disabled={saving}>
                {saving ? m['forms.saving']() : m['common.save']()}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
