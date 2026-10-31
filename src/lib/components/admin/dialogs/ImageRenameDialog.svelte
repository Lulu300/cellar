<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import type { ImageRenameDTO } from '#lib/shared/dto.js';

    let {
        open = $bindable(false),
        image
    }: {
        open: boolean;
        image: { id: string; filename: string } | null;
    } = $props();

    let newName = $state('');
    let renaming = $state(false);
    // Rename is greyed until the name changes: a line under the field says so.
    const changed = $derived(newName.trim() !== '' && newName.trim() !== image?.filename);
    const unchangedId = $props.id();

    // Starts from the current name each time it opens.
    $effect(() => {
        if (open) newName = image?.filename ?? '';
    });

    async function rename(event: SubmitEvent) {
        event.preventDefault();
        if (!image || !changed || renaming) return;
        renaming = true;
        try {
            const result = await request<ImageRenameDTO>('/api/admin/images', {
                method: 'PUT',
                json: { imageId: image.id, newFilename: newName.trim() }
            });
            toasts.add(
                result.wines.length > 0
                    ? m['toast.image_renamed_with_updates']({ count: result.wines.length })
                    : m['toast.image_renamed_successfully'](),
                'success'
            );
            open = false;
            await invalidateAll();
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        } finally {
            renaming = false;
        }
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['admin.rename_image']()}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4 py-4" onsubmit={rename}>
            <p class="text-sm">
                {m['admin.current_name']()}
                <span class="font-mono break-all">{image?.filename}</span>
            </p>
            <div class="space-y-2">
                <Label for="image-name-input">{m['admin.new_name']()}</Label>
                <Input
                    id="image-name-input"
                    bind:value={newName}
                    placeholder={m['placeholders.enter_new_image_name']()}
                    aria-describedby={changed ? undefined : unchangedId}
                />
                {#if !changed}
                    <p id={unchangedId} class="text-xs text-muted-foreground">
                        {m['admin.image_name_unchanged']()}
                    </p>
                {/if}
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" onclick={() => (open = false)}>
                    {m['common.cancel']()}
                </Button>
                <Button
                    type="submit"
                    disabled={!changed || renaming}
                    aria-describedby={changed ? undefined : unchangedId}
                >
                    {m['admin.rename']()}
                </Button>
            </div>
        </form>
    </DialogContent>
</Dialog>
