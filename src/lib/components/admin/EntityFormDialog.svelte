<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { errorMessage, request } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { ReferenceEntity } from '#lib/components/admin/entities.js';
    import type { ReferenceRow } from '#lib/shared/reference-tables.js';

    /** Adds an entry of a reference table, or edits `editing`. */
    let {
        open = $bindable(false),
        entity,
        editing,
        items,
        parents
    }: {
        open: boolean;
        entity: ReferenceEntity;
        editing: ReferenceRow | null;
        /** The entries listed, to tell an existing name from a new one. */
        items: ReferenceRow[];
        /** The rows the parent field offers (countries for a region), if the entity has one. */
        parents: ReferenceRow[];
    } = $props();

    const labels = $derived(entity.labels());
    let name = $state('');
    let parentId = $state('');
    let saving = $state(false);
    const complete = $derived(name.trim() !== '' && (!entity.parent || parentId !== ''));

    // Fills the form each time it opens.
    $effect(() => {
        if (!open) return;
        name = editing?.name ?? '';
        parentId = (entity.parent && editing?.[entity.parent]) || '';
    });

    async function save(event: SubmitEvent) {
        event.preventDefault();
        if (!complete || saving) return;
        saving = true;
        try {
            const endpoint = `/api/${entity.slug}`;
            const saved = await request<ReferenceRow>(
                editing ? `${endpoint}/${editing.id}` : endpoint,
                {
                    method: editing ? 'PUT' : 'POST',
                    json: { name: name.trim(), ...(entity.parent && { [entity.parent]: parentId }) }
                }
            );
            // A POST answers the entry that already has this name, and adds nothing.
            if (!editing && items.some((item) => item.id === saved.id)) {
                toasts.add(labels.duplicate, 'error');
                return;
            }
            toasts.add(editing ? labels.updated : labels.added, 'success');
            open = false;
            await invalidateAll();
        } catch (error) {
            toasts.add(errorMessage(error), 'error');
        } finally {
            saving = false;
        }
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{editing ? labels.edit : labels.add}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4 py-4" onsubmit={save}>
            <div class="space-y-2">
                <Label for="entity-name">{labels.name}</Label>
                <Input id="entity-name" bind:value={name} placeholder={labels.namePlaceholder} />
            </div>
            {#if labels.parent}
                <div class="space-y-2">
                    <Label for="entity-parent">{labels.parent.label}</Label>
                    <OptionSelect
                        id="entity-parent"
                        bind:value={parentId}
                        placeholder={labels.parent.placeholder}
                        options={parents.map((parent) => ({
                            value: parent.id,
                            label: parent.countryName
                                ? `${parent.name} (${parent.countryName})`
                                : parent.name
                        }))}
                    />
                </div>
            {/if}
            <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" onclick={() => (open = false)}>
                    {m['common.cancel']()}
                </Button>
                <Button type="submit" disabled={!complete || saving}>
                    {editing ? m['common.save']() : m['common.add']()}
                </Button>
            </div>
        </form>
    </DialogContent>
</Dialog>
