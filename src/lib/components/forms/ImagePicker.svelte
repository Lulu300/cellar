<script lang="ts">
    import { Image, Search, X } from '@lucide/svelte';
    import { request } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import type { AdminImagesDTO, Jsonified } from '#lib/shared/dto.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { formatFileSize } from '#lib/utils/format.js';
    import { matchesImageSearch } from '#lib/utils/image-search.js';
    import FormField from './FormField.svelte';
    import PhotoCapture from './PhotoCapture.svelte';

    type ExistingImage = Jsonified<AdminImagesDTO>['images'][number];

    /**
     * The main photo of a wine: an image already stored, whose id the form sends, or a new photo,
     * which the dialog uploads when it saves.
     */
    let {
        imageId = $bindable(''),
        file = $bindable(null),
        previewUrl = $bindable('')
    }: { imageId?: string; file?: File | null; previewUrl?: string } = $props();

    let browsing = $state(false);
    let images = $state<ExistingImage[] | null>(null);
    let query = $state('');

    const shownImages = $derived(
        (images ?? []).filter((image) => matchesImageSearch(image, query))
    );

    // Frees the preview of a chosen file once it is replaced or the form closes.
    $effect(() => {
        const url = previewUrl;
        return () => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        };
    });

    function takePhoto(photo: File) {
        remove();
        file = photo;
        previewUrl = URL.createObjectURL(photo);
    }

    function remove() {
        file = null;
        imageId = previewUrl = '';
    }

    async function toggleBrowsing() {
        browsing = !browsing;
        query = '';
        if (!browsing || images) return;
        try {
            images = (await request<Jsonified<AdminImagesDTO>>('/api/admin/images')).images;
        } catch {
            toasts.add(m['toast.failed_to_load_existing_images'](), 'error');
            images = [];
        }
    }

    function choose(image: ExistingImage) {
        remove();
        imageId = image.id;
        previewUrl = image.url;
        browsing = false;
    }
</script>

<FormField label={m['common.main_photo']()} hint={m['wine_form.image_hint']()}>
    <input type="hidden" name="imageId" value={imageId} />
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
                    class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-white hover:bg-red-800"
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
        <Button type="button" variant="outline" onclick={toggleBrowsing}>
            <Image class="mr-2 h-4 w-4" />
            {m['forms.browse_existing']()}
        </Button>
    </div>

    {#if browsing}
        <div class="rounded-lg border bg-muted/30 p-4">
            <div class="relative mb-3">
                <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={m['wine_form.search_images']()}
                    aria-label={m['wine_form.search_images']()}
                    bind:value={query}
                    class="pl-8"
                />
            </div>
            {#if !images}
                <p class="py-4 text-center text-sm text-muted-foreground">
                    {m['wine_form.loading_images']()}
                </p>
            {:else if shownImages.length === 0}
                <p class="py-4 text-center text-sm text-muted-foreground">
                    {query ? m['wine_form.no_image_matches']() : m['wine_form.no_images']()}
                </p>
            {:else}
                <div
                    class="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6"
                >
                    {#each shownImages as image (image.id)}
                        <button
                            type="button"
                            class="group relative aspect-square overflow-hidden rounded-md border hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
                            title={[image.filename, ...image.wines.map((wine) => wine.name)].join(
                                ', '
                            )}
                            onclick={() => choose(image)}
                        >
                            <img
                                src={image.url}
                                alt={image.filename}
                                class="h-full w-full object-cover"
                                loading="lazy"
                            />
                            <!-- White on a dark veil stays readable over any photo, in every theme. -->
                            <span
                                class="absolute inset-x-0 bottom-0 bg-black/60 px-1 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            >
                                <span class="block truncate">{image.filename}</span>
                                <span class="opacity-75">{formatFileSize(image.size)}</span>
                            </span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</FormField>
