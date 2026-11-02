<script lang="ts">
    import { Star, Trash2 } from '@lucide/svelte';
    import { invalidate } from '$app/navigation';
    import { errorMessage, request } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import PhotoCapture from '#lib/components/forms/PhotoCapture.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { focusRing } from '#lib/components/layout/button-states.js';

    interface Photo {
        imageId: string;
        url: string;
        main: boolean;
    }

    /** The photos of a wine, its main one first: one shown large, the others as thumbnails. */
    let { wineId, wineName, photos }: { wineId: string; wineName: string; photos: Photo[] } =
        $props();

    let shownId = $state<string | null>(null);
    let busy = $state(false);

    // The photo chosen, until it is removed: then the main one.
    const shown = $derived(photos.find(({ imageId }) => imageId === shownId) ?? photos[0]);
    const photosUrl = $derived(`/api/definitions/${encodeURIComponent(wineId)}/photos`);

    /** Runs a change of the photos, then reloads them; a refusal is told in a toast. */
    async function change(send: () => Promise<unknown>) {
        busy = true;
        try {
            await send();
            await invalidate(CELLAR);
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        } finally {
            busy = false;
        }
    }

    function add(photo: File) {
        const body = new FormData();
        body.append('image', photo);
        return change(async () => {
            const answer = await request<{ photos: Photo[] }>(photosUrl, { method: 'POST', body });
            shownId = answer.photos.at(-1)?.imageId ?? null;
        });
    }

    const makeMain = (photo: Photo) =>
        change(() =>
            request(`/api/definitions/${encodeURIComponent(wineId)}/main-photo`, {
                method: 'PUT',
                json: { imageId: photo.imageId }
            })
        );

    async function remove(photo: Photo) {
        if (!(await confirm({ message: m['wine_photos.delete_confirm']() }))) return;
        await change(() =>
            request(`${photosUrl}/${encodeURIComponent(photo.imageId)}`, { method: 'DELETE' })
        );
    }
</script>

<div class="flex w-full max-w-xs flex-col items-center gap-3">
    {#if shown}
        <a href={shown.url} target="_blank" rel="noopener" title={m['wine_photos.open']()}>
            <img src={shown.url} alt={wineName} class="h-64 w-48 rounded bg-muted object-contain" />
        </a>
        {#if photos.length > 1}
            <div class="flex flex-wrap justify-center gap-2">
                {#each photos as photo, index (photo.imageId)}
                    <button
                        type="button"
                        class="relative size-14 overflow-hidden rounded border-2 transition-colors {focusRing} {photo ===
                        shown
                            ? 'border-primary'
                            : 'border-transparent hover:border-input'}"
                        aria-label={m['wine_photos.show']({ number: index + 1 })}
                        aria-pressed={photo === shown}
                        onclick={() => (shownId = photo.imageId)}
                    >
                        <img src={photo.url} alt="" class="h-full w-full object-cover" />
                    </button>
                {/each}
            </div>
        {/if}
        <div class="flex flex-wrap items-center justify-center gap-2">
            {#if shown.main}
                <Badge variant="secondary">{m['common.main_photo']()}</Badge>
            {:else if auth.isAuthenticated}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={() => makeMain(shown)}
                >
                    <Star class="mr-2 h-4 w-4" />
                    {m['wine_photos.make_main']()}
                </Button>
            {/if}
            {#if auth.isAuthenticated}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={() => remove(shown)}
                >
                    <Trash2 class="mr-2 h-4 w-4" />
                    {m['wine_photos.delete']()}
                </Button>
            {/if}
        </div>
    {:else}
        <div class="flex h-64 w-48 items-center justify-center rounded bg-muted">
            <div class="text-center text-muted-foreground">
                <svg
                    class="w-12 h-12 mx-auto mb-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <path
                        d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                    />
                </svg>
                <span class="text-sm">{m['wine_details.no_image_available']()}</span>
            </div>
        </div>
    {/if}
    {#if auth.isAuthenticated}
        <div class="flex flex-wrap justify-center gap-2">
            <PhotoCapture onPhoto={add} disabled={busy} />
        </div>
        {#if busy}
            <p class="text-sm text-muted-foreground" role="status">{m['wine_photos.saving']()}</p>
        {/if}
    {/if}
</div>
