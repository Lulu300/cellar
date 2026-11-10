<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
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
        bottles: { id: string; availability: string; storageCase?: { id: string } | null }[];
        onClose: () => void;
        /** After the move, before the dialog closes: the screen reloads its bottles. */
        onSaved: () => Promise<void> | void;
        /** Bottles deleted elsewhere: the screen leaves them out of `bottles` and reloads. */
        onMissing: (ids: string[]) => Promise<void> | void;
    } = $props();

    let caseId = $state('');
    let overfilled = $state(false);

    // A move changes no status: a bottle out of the cellar takes no place in its new case.
    const moved = $derived(
        bottles.map(({ availability, storageCase }) => {
            const inCellar = availability === BottleAvailability.AVAILABLE;
            return { caseId: storageCase?.id ?? null, inCellar, inCellarAfter: inCellar };
        })
    );

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
                        ({m['common.bottles_selected']({ count: bottles.length })})
                    </span>
                {/if}
            </DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <CaseTargetPicker
                bind:caseId
                bind:overfilled
                bottles={moved}
                label={m['forms.storage_case']()}
                hint={m['admin.storage_location_hint']()}
                disabled={changes.sending}
            />
            <ConfirmButtons
                sending={changes.sending}
                refused={overfilled}
                onCancel={onClose}
                onConfirm={confirm}
            />
        </div>
    </DialogContent>
</Dialog>
