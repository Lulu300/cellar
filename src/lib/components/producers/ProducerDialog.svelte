<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import type { ProducerDTO } from '#lib/shared/dto.js';
    import ProducerForm from './ProducerForm.svelte';

    /** Adds a producer, or edits `producer`. */
    let {
        open = $bindable(false),
        producer = null,
        imageUrl,
        onSaved
    }: {
        open?: boolean;
        producer?: ComponentProps<typeof ProducerForm>['producer'];
        imageUrl?: string;
        /** Called once the dialog has closed on the producer saved. */
        onSaved: (producer: ProducerDTO) => void;
    } = $props();

    function saved(saved: ProducerDTO) {
        open = false;
        onSaved(saved);
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>{producer ? m['producers.edit']() : m['producers.add']()}</DialogTitle>
        </DialogHeader>
        <!-- Mounted at each opening: the form starts from the producer as it is then. -->
        <ProducerForm {producer} {imageUrl} onSaved={saved} onCancel={() => (open = false)} />
    </DialogContent>
</Dialog>
