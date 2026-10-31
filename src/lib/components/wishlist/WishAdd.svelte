<script lang="ts">
    import { onDestroy } from 'svelte';
    import { Plus } from '@lucide/svelte';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { ImageUploads } from '#lib/components/forms/image-uploads.js';
    import PhotoField from '#lib/components/forms/PhotoField.svelte';
    import { NAME_MAX_LENGTH } from '#lib/shared/schemas/common.js';
    import { addWish, saveWithPhoto } from './wishes.js';

    type Wine = { id: string; name: string; producer: string | null };

    /** The most wines that the field suggests. */
    const MAX_SUGGESTIONS = 5;

    /**
     * The field that adds a wish: the name typed suggests the wines of the cellar that match, one
     * of which goes on the list as it is; otherwise the name becomes a text wish, with a photo of
     * its label if wanted.
     */
    let { wines }: { wines: Wine[] } = $props();

    const fieldId = $props.id();
    let text = $state('');
    let imageId = $state('');
    let file = $state<File | null>(null);
    let previewUrl = $state('');
    let saving = $state(false);

    const uploads = new ImageUploads();
    onDestroy(() => uploads.close());

    // Loaded by the root layout: the wines already on the list
    const wishedWines: Record<string, string> = $derived(page.data.wishedWines ?? {});

    // The wines whose name and producer hold every word typed, as the search of the wine list does
    const suggestions = $derived.by(() => {
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        return wines
            .filter((wine) => {
                const label = `${wine.name} ${wine.producer ?? ''}`.toLowerCase();
                return words.every((word) => label.includes(word));
            })
            .slice(0, MAX_SUGGESTIONS);
    });

    async function addText(event: SubmitEvent) {
        event.preventDefault();
        if (!text.trim()) return;
        saving = true;
        const saved = await saveWithPhoto(uploads, { file, imageId }, (photoId) =>
            addWish({ text, imageId: photoId })
        );
        saving = false;
        if (saved) {
            text = imageId = previewUrl = '';
            file = null;
        }
    }

    // A wine of the cellar shows its own photos: a photo chosen for a text stays for the next one.
    async function addWine(wine: Wine) {
        saving = true;
        const saved = await saveWithPhoto(uploads, { file: null, imageId: '' }, () =>
            addWish({ definitionId: wine.id })
        );
        saving = false;
        if (saved) text = '';
    }
</script>

<Card class="mb-6 py-0">
    <CardContent class="space-y-4 p-4">
        <form class="flex flex-wrap items-end gap-2" onsubmit={addText}>
            <div class="min-w-0 flex-1 basis-64 space-y-1">
                <label for="{fieldId}-text" class="text-sm font-medium">
                    {m['wishlist.add_label']()}
                </label>
                <Input
                    id="{fieldId}-text"
                    bind:value={text}
                    maxlength={NAME_MAX_LENGTH}
                    autocomplete="off"
                    placeholder={m['wishlist.add_placeholder']()}
                    aria-describedby="{fieldId}-hint"
                />
            </div>
            <Button type="submit" disabled={saving || !text.trim()}>
                <Plus class="mr-2 h-4 w-4" />
                {m['common.add']()}
            </Button>
        </form>
        <p id="{fieldId}-hint" class="text-xs text-muted-foreground">
            {m['wishlist.add_hint']()}
        </p>

        {#if suggestions.length > 0}
            <section aria-labelledby="{fieldId}-suggestions">
                <h2 id="{fieldId}-suggestions" class="mb-1 text-sm font-medium">
                    {m['wishlist.in_cellar_already']()}
                </h2>
                <ul class="flex flex-col gap-1">
                    {#each suggestions as wine (wine.id)}
                        {@const wished = !!wishedWines[wine.id]}
                        <li>
                            <Button
                                variant="outline"
                                class="h-auto w-full justify-between gap-2 py-2 text-left whitespace-normal"
                                disabled={saving || wished}
                                onclick={() => addWine(wine)}
                            >
                                <span>
                                    {wine.name}
                                    {#if wine.producer}
                                        <span class="text-muted-foreground">· {wine.producer}</span>
                                    {/if}
                                </span>
                                <span class="shrink-0 text-xs text-muted-foreground">
                                    {wished ? m['wishlist.on_the_list']() : m['common.add']()}
                                </span>
                            </Button>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        <PhotoField
            label={m['wishlist.photo']()}
            hint={m['wishlist.photo_hint']()}
            bind:imageId
            bind:file
            bind:previewUrl
        />
    </CardContent>
</Card>
