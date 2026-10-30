<script lang="ts">
    import type { Snippet } from 'svelte';
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { today } from '#lib/utils/format.js';
    import { availabilityLabel } from './availability.js';
    import {
        BottleChanges,
        newStatus,
        proposedStatus,
        statusChoices
    } from './bottle-changes.svelte.js';
    import ConfirmButtons from './ConfirmButtons.svelte';
    import ConsumptionFields from './ConsumptionFields.svelte';

    /**
     * Gives bottles a new status. The screen mounts it to open it, with the bottles to change, and
     * unmounts it on `onClose`.
     */
    let {
        bottles,
        onClose,
        onSaved,
        onMissing,
        children
    }: {
        bottles: { id: string; availability: string }[];
        onClose: () => void;
        /** After the change, before the dialog closes: the screen reloads its bottles. */
        onSaved: () => Promise<void> | void;
        /** Bottles deleted elsewhere: the screen leaves them out of `bottles` and reloads. */
        onMissing: (ids: string[]) => Promise<void> | void;
        /** What the screen shows of the bottles above the status. */
        children?: Snippet;
    } = $props();

    const choices = $derived(statusChoices(bottles.map(({ availability }) => availability)));
    // The status picked, while the bottles can take it: bottles deleted elsewhere change the list.
    let picked = $state('');
    const status = $derived(choices.find((choice) => choice === picked) ?? proposedStatus(choices));
    let consumedDate = $state(today());
    let note = $state('');

    const changes = new BottleChanges({
        onSaved: async (count) => {
            toasts.add(m['toast.bottles_updated']({ count }), 'success');
            await onSaved();
            onClose();
        },
        onMissing: (ids) => onMissing(ids)
    });

    function confirm() {
        changes.send(
            bottles.map(({ id }) => id),
            newStatus(status, consumedDate, note)
        );
    }

    const id = $props.id();
</script>

<!-- Not closed while a change is on its way: the guard against sending it twice goes with the dialog. -->
<Dialog bind:open={() => true, (open) => !open && !changes.sending && onClose()}>
    <DialogContent class="max-w-md" showCloseButton={!changes.sending}>
        <DialogHeader>
            <DialogTitle>
                {m['bottles.change_status_title']({ count: bottles.length })}
            </DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            {@render children?.()}
            <div class="space-y-2">
                <Label for="{id}-status">{m['bottles.change_status_to']()}</Label>
                <Select.Root
                    type="single"
                    bind:value={() => status, (value) => (picked = value)}
                    disabled={changes.sending}
                >
                    <Select.Trigger id="{id}-status" class="w-full">
                        {availabilityLabel(status)}
                    </Select.Trigger>
                    <Select.Content>
                        {#each choices as choice (choice)}
                            <Select.Item value={choice} label={availabilityLabel(choice)}>
                                {availabilityLabel(choice)}
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
            {#if status === BottleAvailability.CONSUMED}
                <ConsumptionFields bind:date={consumedDate} bind:note disabled={changes.sending} />
            {/if}
            <ConfirmButtons sending={changes.sending} onCancel={onClose} onConfirm={confirm} />
        </div>
    </DialogContent>
</Dialog>
