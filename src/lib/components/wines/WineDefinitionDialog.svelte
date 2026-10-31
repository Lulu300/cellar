<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import type { WineDraft, WineFormSource } from '#lib/components/forms/form-sources.js';
    import WineDefinitionForm from '#lib/components/forms/WineDefinitionForm.svelte';
    import type { SavedDefinitionDTO } from '#lib/shared/dto.js';

    /** Creates a wine, from scratch or from `draft`, duplicates `editDefinition` or edits it. */
    let {
        open = $bindable(false),
        editDefinition = null,
        draft,
        duplicateMode = false,
        imageUrl,
        onSaved
    }: {
        open?: boolean;
        editDefinition?: WineFormSource | null;
        draft?: WineDraft;
        duplicateMode?: boolean;
        /** The URL of the image of `editDefinition` or `draft`, for its preview. */
        imageUrl?: string;
        /** Called once the dialog has closed on the wine saved, with whether to add a bottle to it. */
        onSaved: (definition: SavedDefinitionDTO, addBottle: boolean) => void;
    } = $props();

    function saved(definition: SavedDefinitionDTO, addBottle: boolean) {
        open = false;
        onSaved(definition, addBottle);
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
            <DialogTitle>
                {#if duplicateMode}
                    {m['forms.duplicate_wine']()}
                {:else if editDefinition}
                    {m['forms.edit_wine']()}
                {:else}
                    {m['forms.add_wine']()}
                {/if}
            </DialogTitle>
        </DialogHeader>
        <!-- Mounted at each opening: the form starts from the wine as it is then. -->
        <WineDefinitionForm
            wine={editDefinition}
            {draft}
            duplicate={duplicateMode}
            {imageUrl}
            onSaved={saved}
            onCancel={() => (open = false)}
        />
    </DialogContent>
</Dialog>
