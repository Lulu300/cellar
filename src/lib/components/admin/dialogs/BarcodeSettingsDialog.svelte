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
    import { Package } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import type {
        BarcodeConflictDTO,
        BarcodeSettingsDTO,
        BarcodeSettingsUpdateDTO
    } from '#lib/shared/dto.js';
    import { isValidBarcodePrefix } from '#lib/shared/barcode.js';

    let {
        open = $bindable(false),
        settings,
        onConflictInfo
    }: {
        open: boolean;
        /** The saved settings, which the form starts from. */
        settings: BarcodeSettingsDTO;
        onConflictInfo: (conflictInfo: BarcodeConflictDTO) => void;
    } = $props();

    // Filled from `settings` each time the dialog opens.
    let form = $state<BarcodeSettingsDTO>({ autoGeneration: true, prefix: '', startNumber: 1 });
    let error = $state('');
    let saving = $state(false);

    $effect(() => {
        if (!open) return;
        form = { ...settings };
        error = '';
    });

    async function save() {
        error = '';
        saving = true;
        try {
            const result = await request<BarcodeSettingsUpdateDTO>('/api/admin/barcode-settings', {
                method: 'PUT',
                json: form
            });
            toasts.add(m['toast.barcode_settings_saved'](), 'success');
            open = false;
            if (result.conflictInfo?.hasConflict) onConflictInfo(result.conflictInfo);
            await invalidateAll();
        } catch (failure) {
            error = errorMessage(failure);
        } finally {
            saving = false;
        }
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['admin.barcode_settings']()}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                >
                    <Package class="h-5 w-5 text-primary" />
                </div>
                <div class="flex-1">
                    <p class="text-sm text-muted-foreground mb-4">
                        {m['admin.barcode_description']()}
                    </p>
                    <div class="space-y-4">
                        <div class="flex items-center space-x-2">
                            <input
                                id="barcode-auto"
                                type="checkbox"
                                bind:checked={form.autoGeneration}
                                class="rounded border-input"
                            />
                            <Label for="barcode-auto"
                                >{m['admin.barcode_enable_automatic_generation']()}</Label
                            >
                        </div>

                        {#if form.autoGeneration}
                            <div class="space-y-2">
                                <Label for="barcode-prefix"
                                    >{m['admin.barcode_prefix_max_chars']()}</Label
                                >
                                <Input
                                    id="barcode-prefix"
                                    type="text"
                                    bind:value={form.prefix}
                                    maxlength={6}
                                    aria-invalid={!isValidBarcodePrefix(form.prefix)}
                                    placeholder={m['placeholders.barcode_prefix_example']()}
                                    class="w-full"
                                />
                                <p class="text-xs text-muted-foreground">
                                    {m['admin.barcode_optional_prefix_description']()}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {m['admin.barcode_prefix_shares_numbers']()}
                                </p>
                            </div>

                            <div class="space-y-2">
                                <Label for="start-number">{m['barcode.starting_number']()}</Label>
                                <Input
                                    id="start-number"
                                    type="number"
                                    bind:value={form.startNumber}
                                    min="1"
                                    placeholder={m['placeholders.barcode_start_number_example']()}
                                    class="w-full"
                                />
                                <p class="text-xs text-muted-foreground">
                                    {m['admin.barcode_start_number_description']()}
                                </p>
                            </div>

                            <div class="bg-primary/10 border border-primary/30 rounded-lg p-3">
                                <p class="text-xs text-foreground">
                                    <strong>{m['admin.barcode_example']()}</strong>
                                    {m['admin.barcode_generation_example']()}
                                </p>
                            </div>
                        {:else}
                            <div class="bg-warning/10 border border-warning/30 rounded-lg p-3">
                                <p class="text-xs text-warning">
                                    {m['admin.manual_barcode_entry_note']()}
                                </p>
                            </div>
                        {/if}

                        {#if error}
                            <p class="text-sm text-destructive">{error}</p>
                        {/if}
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="outline" onclick={() => (open = false)}>
                    {m['common.cancel']()}
                </Button>
                <Button onclick={save} disabled={saving}>
                    {m['common.save']()}
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
