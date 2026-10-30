<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { BottleChanges } from './bottle-changes.svelte.js';
    import CaseTargetPicker from './CaseTargetPicker.svelte';
    import ConfirmButtons from './ConfirmButtons.svelte';

    /**
     * Moves bottles to another case, or out of any case. The screen mounts it to open it, with the
     * bottles to move, and unmounts it on `onClose`.
     */
    let {
        bottles,
        onClose,
        onSaved,
        onMissing
    }: {
        bottles: { id: string; storageCase?: { id: string } | null }[];
        onClose: () => void;
        /** After the move, before the dialog closes: the screen reloads its bottles. */
        onSaved: () => Promise<void> | void;
        /** Bottles deleted elsewhere: the screen leaves them out of `bottles` and reloads. */
        onMissing: (ids: string[]) => Promise<void> | void;
    } = $props();

    let caseId = $state('');

    // The case they leave, when they all leave the same one
    const currentCaseId = $derived.by(() => {
        const first = bottles[0]?.storageCase?.id;
        return bottles.every((bottle) => bottle.storageCase?.id === first) ? first : undefined;
    });

    const changes = new BottleChanges({
        onSaved: async (count) => {
            toasts.add(m['toast.bottles_storage_updated']({ count }), 'success');
            await onSaved();
            onClose();
        },
        onMissing: (ids) => onMissing(ids)
    });

    function confirm() {
        changes.send(
            bottles.map(({ id }) => id),
            { changes: { storageCaseId: caseId || null } }
        );
    }
</script>

<!-- Not closed while a change is on its way: the guard against sending it twice goes with the dialog. -->
<Dialog bind:open={() => true, (open) => !open && !changes.sending && onClose()}>
    <DialogContent class="max-w-md" showCloseButton={!changes.sending}>
        <DialogHeader>
            <DialogTitle>
                {m['admin.change_storage_location']()}
                {#if bottles.length > 1}
                    <span class="text-sm font-normal text-muted-foreground ml-2">
                        ({m['admin.bottles_selected']({ count: bottles.length })})
                    </span>
                {/if}
            </DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <CaseTargetPicker
                bind:caseId
                incoming={bottles.length}
                {currentCaseId}
                label={m['forms.storage_case']()}
                hint={m['admin.storage_location_hint']()}
                disabled={changes.sending}
            />
            <ConfirmButtons sending={changes.sending} onCancel={onClose} onConfirm={confirm} />
        </div>
    </DialogContent>
</Dialog>
