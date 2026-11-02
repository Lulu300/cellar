<script lang="ts">
    import { Image, Search } from '@lucide/svelte';
    import { request } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import type { AdminImagesDTO, Jsonified } from '#lib/shared/dto.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { formatFileSize } from '#lib/utils/format.js';
    import { matchesImageSearch } from '#lib/utils/image-search.js';
    import PhotoField from './PhotoField.svelte';
    import { focusRing } from '#lib/components/layout/button-states.js';

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
        file = null;
        imageId = image.id;
        previewUrl = image.url;
        browsing = false;
    }
</script>

<PhotoField
    label={m['common.main_photo']()}
    hint={m['wine_form.image_hint']()}
    name="imageId"
    bind:imageId
    bind:file
    bind:previewUrl
>
    {#snippet actions()}
        <Button type="button" variant="outline" onclick={toggleBrowsing}>
            <Image class="mr-2 h-4 w-4" />
            {m['forms.browse_existing']()}
        </Button>
    {/snippet}

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
                            class="group relative aspect-square overflow-hidden rounded-md border hover:ring-2 hover:ring-primary {focusRing}"
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
</PhotoField>
