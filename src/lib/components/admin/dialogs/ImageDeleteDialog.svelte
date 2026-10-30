<script lang="ts">
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { CircleAlert } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { invalidateAll } from '$app/navigation';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { ApiError, errorMessage, request } from '#lib/api/client.js';
    import { wineLabel } from '#lib/components/admin/wine-labels.js';

    interface Wine {
        id: string;
        name: string;
        producer: string | null;
    }

    interface ImageInUse {
        id: string;
        filename: string;
        wines: Wine[];
    }

    let {
        open = $bindable(false),
        imagesToDelete = [],
        images = []
    }: {
        open: boolean;
        /** Image ids. */
        imagesToDelete: string[];
        images: { id: string; filename: string }[];
    } = $props();

    // The server's 409, for the list it answered: the user then confirms with "Delete anyway". Kept
    // with that list so that an answer arriving after the dialog closed, or reopened for other
    // images, cannot make "Delete anyway" apply to images whose wines were never shown.
    let conflict = $state.raw<{ imageIds: string[]; inUse: ImageInUse[] } | null>(null);
    const imagesInUse = $derived(conflict?.imageIds === imagesToDelete ? conflict.inUse : []);
    let isDeleting = $state(false);

    const filenames = $derived(
        imagesToDelete.map((id) => images.find((image) => image.id === id)?.filename ?? id)
    );
    const listedFilenames = $derived(filenames.length > 5 ? filenames.slice(0, 3) : filenames);

    function closeDialog() {
        open = false;
        conflict = null;
    }

    async function deleteImages(force: boolean) {
        const imageIds = imagesToDelete;
        // With force, the images leave the wines that the 409 listed.
        const wines = force
            ? imagesInUse.reduce((count, image) => count + image.wines.length, 0)
            : 0;
        isDeleting = true;
        try {
            await request('/api/admin/images', { method: 'DELETE', json: { imageIds, force } });
            const count = imageIds.length;
            toasts.add(
                wines > 0
                    ? m['toast.images_deleted_with_updates']({ count, wines })
                    : m['toast.images_deleted_success']({ count }),
                'success'
            );
            // The dialog may have been reopened for other images meanwhile.
            if (imageIds === imagesToDelete) closeDialog();
            await invalidateAll();
        } catch (error) {
            if (error instanceof ApiError && error.code === 'in_use') {
                // The images that wines use: "Delete anyway" then removes them from those wines.
                conflict = { imageIds, inUse: error.details<{ inUse: ImageInUse[] }>().inUse };
            } else {
                toasts.add(errorMessage(error), 'error');
            }
        } finally {
            isDeleting = false;
        }
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <ScrollingDialogContent
        title={imagesToDelete.length > 1 ? m['admin.delete_images']() : m['admin.delete_image']()}
        class="max-w-md"
    >
        <div class="py-3">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center"
                >
                    <CircleAlert class="h-5 w-5 text-destructive" />
                </div>
                <div>
                    {#if imagesInUse.length === 0}
                        <p class="text-sm">
                            {m['admin.confirm_delete_images']({ count: imagesToDelete.length })}
                        </p>
                        <ul class="mt-2 text-xs text-muted-foreground space-y-1">
                            {#each listedFilenames as filename (filename)}
                                <li class="font-mono">• {filename}</li>
                            {/each}
                            {#if filenames.length > listedFilenames.length}
                                <li>
                                    {m['admin.and_more']({
                                        count: filenames.length - listedFilenames.length
                                    })}
                                </li>
                            {/if}
                        </ul>
                    {:else}
                        <p class="text-sm">
                            {m['admin.images_used_by_wines']({ count: imagesInUse.length })}
                        </p>
                        <ul class="mt-2 text-xs text-muted-foreground space-y-1">
                            {#each imagesInUse as image (image.id)}
                                <li>
                                    <span class="font-mono">{image.filename}</span>:
                                    {image.wines.map(wineLabel).join(', ')}
                                </li>
                            {/each}
                        </ul>
                        <p class="mt-2 text-sm">
                            {m['admin.delete_anyway_removes_images']({ count: imagesInUse.length })}
                        </p>
                    {/if}
                    <p class="mt-2 text-xs text-destructive">
                        {m['admin.action_cannot_be_undone']()}
                    </p>
                </div>
            </div>
        </div>
        {#snippet footer()}
            <Button variant="outline" onclick={closeDialog}>
                {m['common.cancel']()}
            </Button>
            {#if imagesInUse.length === 0}
                <Button
                    variant="destructive"
                    disabled={isDeleting}
                    onclick={() => deleteImages(false)}
                >
                    {imagesToDelete.length > 1
                        ? m['admin.delete_images']()
                        : m['admin.delete_image']()}
                </Button>
            {:else}
                <Button
                    variant="destructive"
                    disabled={isDeleting}
                    onclick={() => deleteImages(true)}
                >
                    {m['admin.delete_anyway']()}
                </Button>
            {/if}
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
