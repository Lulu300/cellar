<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import type { BottleFormSource } from '#lib/components/forms/form-sources.js';
    import WineBottleForm from '#lib/components/forms/WineBottleForm.svelte';
    import type { BottleDTO } from '#lib/shared/dto.js';

    /** Adds bottles, of the wine `selectedDefinitionId` when given, duplicates `editBottle` or edits it. */
    let {
        open = $bindable(false),
        selectedDefinitionId,
        editBottle = null,
        duplicateMode = false,
        onSaved
    }: {
        open?: boolean;
        selectedDefinitionId?: string;
        editBottle?: BottleFormSource | null;
        duplicateMode?: boolean;
        /**
         * Called after each save, with whether the dialog stays open for another bottle: it
         * closes itself otherwise.
         */
        onSaved: (addAnother: boolean) => void;
    } = $props();

    // A new form for each bottle added in a row
    let formKey = $state(0);

    // The form gives the bottles saved, which no page reads.
    function saved(_bottles: BottleDTO[], addAnother: boolean) {
        if (addAnother) formKey++;
        else open = false;
        onSaved(addAnother);
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
            <DialogTitle>
                {#if duplicateMode}
                    {m['forms.duplicate_wine_bottle']()}
                {:else if editBottle}
                    {m['forms.edit_wine_bottle']()}
                {:else}
                    {m['forms.add_wine_bottle']()}
                {/if}
            </DialogTitle>
        </DialogHeader>
        <!-- Mounted at each opening, and again after each bottle added in a row. -->
        {#key formKey}
            <WineBottleForm
                bottle={editBottle}
                duplicate={duplicateMode}
                definitionId={selectedDefinitionId}
                onSaved={saved}
                onCancel={() => (open = false)}
            />
        {/key}
    </DialogContent>
</Dialog>
