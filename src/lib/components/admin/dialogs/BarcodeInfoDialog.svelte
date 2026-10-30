<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Package } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { BarcodeConflictDTO } from '#lib/shared/dto.js';

    let {
        open = $bindable(false),
        barcodeInfoData = null
    }: {
        open: boolean;
        barcodeInfoData: BarcodeConflictDTO | null;
    } = $props();

    function closeDialog() {
        open = false;
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['admin.next_barcode_information']()}</DialogTitle>
        </DialogHeader>
        {#if barcodeInfoData}
            <div class="space-y-4 py-4">
                <div class="flex items-start gap-3">
                    <div
                        class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                    >
                        <Package class="h-5 w-5 text-primary" />
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-muted-foreground mb-4">
                            {m['barcode.barcode_settings_saved_successfully']()}
                        </p>

                        <div class="bg-primary/10 border border-primary/30 rounded-lg p-3">
                            <div class="space-y-2">
                                <p class="text-sm font-medium text-foreground">
                                    📋 {m['barcode.next_barcode']()}
                                    <strong>{barcodeInfoData.nextBarcode}</strong>
                                </p>

                                <p class="text-xs text-muted-foreground">
                                    {m['barcode.start_number_already_given']({
                                        last: barcodeInfoData.actualNext - 1,
                                        start: barcodeInfoData.requestedStart
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-center">
                    <Button onclick={closeDialog} class="px-8">{m['common.close']()}</Button>
                </div>
            </div>
        {/if}
    </DialogContent>
</Dialog>
