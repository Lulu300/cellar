<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Key } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';

    let {
        open = $bindable(false),
        onConfirm
    }: {
        open: boolean;
        onConfirm: (overrideAllBarcodes: boolean) => Promise<void>;
    } = $props();

    let overrideAllBarcodes = $state(false);

    // Keeping the barcodes of the file is the choice offered each time it opens.
    $effect(() => {
        if (open) overrideAllBarcodes = false;
    });

    async function confirmBarcodeOverride() {
        open = false;
        await onConfirm(overrideAllBarcodes);
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <Key class="h-5 w-5" />
                {m['admin.imported_bottle_barcodes']()}
            </DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
            <div class="text-sm text-muted-foreground">
                {m['admin.barcode_import_question']()}
            </div>

            <div class="space-y-3">
                <label class="flex items-start gap-3 cursor-pointer">
                    <input
                        type="radio"
                        bind:group={overrideAllBarcodes}
                        value={false}
                        class="mt-0.5"
                    />
                    <div class="space-y-1">
                        <div class="font-medium">{m['admin.keep_existing_barcodes']()}</div>
                        <div class="text-xs text-muted-foreground">
                            {m['admin.keep_existing_barcodes_description']()}
                        </div>
                    </div>
                </label>

                <label class="flex items-start gap-3 cursor-pointer">
                    <input
                        type="radio"
                        bind:group={overrideAllBarcodes}
                        value={true}
                        class="mt-0.5"
                    />
                    <div class="space-y-1">
                        <div class="font-medium">{m['admin.override_all_barcodes']()}</div>
                        <div class="text-xs text-muted-foreground">
                            {m['admin.override_all_barcodes_description']()}
                        </div>
                    </div>
                </label>
            </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
            <Button variant="outline" onclick={() => (open = false)}>
                {m['common.cancel']()}
            </Button>
            <Button onclick={confirmBarcodeOverride}>{m['admin.proceed_with_import']()}</Button>
        </div>
    </DialogContent>
</Dialog>
