<script lang="ts">
    import type { Snippet } from 'svelte';
    import { X } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { formatFileSize } from '#lib/utils/format.js';
    import FormField from './FormField.svelte';
    import PhotoCapture from './PhotoCapture.svelte';
    import { focusRing } from '#lib/components/layout/button-states.js';

    /**
     * A photo of a form: an image already stored, by its id, or a new photo taken or chosen, which
     * the form uploads when it saves; with a preview and a button that removes it. `actions` adds
     * buttons after those of PhotoCapture, and `children` comes under them.
     */
    let {
        label,
        hint,
        name,
        imageId = $bindable(''),
        file = $bindable(null),
        previewUrl = $bindable(''),
        actions,
        children
    }: {
        label: string;
        hint?: string;
        /** The name under which a native form receives `imageId`. */
        name?: string;
        imageId?: string;
        file?: File | null;
        previewUrl?: string;
        actions?: Snippet;
        children?: Snippet;
    } = $props();

    // Frees the preview of a chosen file once it is replaced or the form closes.
    $effect(() => {
        const url = previewUrl;
        return () => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        };
    });

    function takePhoto(photo: File) {
        imageId = '';
        file = photo;
        previewUrl = URL.createObjectURL(photo);
    }

    function remove() {
        file = null;
        imageId = previewUrl = '';
    }
</script>

<FormField {label} {hint}>
    {#if name}<input type="hidden" {name} value={imageId} />{/if}
    {#if previewUrl}
        <div class="flex items-start gap-4">
            <div class="relative">
                <img
                    src={previewUrl}
                    alt={m['forms.wine_preview']()}
                    class="h-24 w-24 rounded-md border object-cover"
                />
                <!-- A fixed opaque red: the button sits over the photo, which a dimmed or theme red
                     would let show through the white cross -->
                <button
                    type="button"
                    class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-white transition-colors hover:bg-red-800 {focusRing}"
                    aria-label={m['wine_form.remove_image']()}
                    onclick={remove}
                >
                    <X class="h-3 w-3" />
                </button>
            </div>
            <p class="text-sm text-muted-foreground">
                {#if file}
                    {m['wine_form.new_image']()}<br />
                    <span class="text-xs">{file.name} ({formatFileSize(file.size)})</span>
                {:else}
                    {m['wine_form.current_image']()}
                {/if}
            </p>
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-2">
        <PhotoCapture onPhoto={takePhoto} />
        {@render actions?.()}
    </div>

    {@render children?.()}
</FormField>
