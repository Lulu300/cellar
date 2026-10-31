<script lang="ts">
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { CircleAlert, Trash } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';

    /** Confirms the wipe of the whole cellar; the page does it. */
    let {
        open = $bindable(false),
        busy,
        onConfirm
    }: { open: boolean; busy: boolean; onConfirm: () => void } = $props();
</script>

<Dialog bind:open>
    <ScrollingDialogContent
        title={m['admin.complete_database_wipe']()}
        icon={CircleAlert}
        iconClass="text-destructive"
        class="max-w-md"
    >
        <div class="py-4">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center"
                >
                    <Trash class="h-5 w-5 text-destructive" />
                </div>
                <div class="flex-1">
                    <p class="text-sm text-foreground mb-2">
                        <strong>⚠️ {m['admin.wipe_critical_warning']()}</strong>
                        {m['admin.wipe_deletes_all']()}
                    </p>
                    <ul class="text-xs text-muted-foreground space-y-1 mb-4">
                        <li>• {m['admin.wipe_all_wines']()}</li>
                        <li>• {m['admin.wipe_all_regions']()}</li>
                        <li>• {m['admin.wipe_all_storage']()}</li>
                        <li>• {m['admin.wipe_all_wine_types']()}</li>
                        <li>• {m['admin.wipe_all_images']()}</li>
                        <li><strong>• {m['admin.wipe_settings_preserved']()}</strong></li>
                    </ul>
                    <div class="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
                        <p class="text-xs text-foreground">
                            <strong>{m['admin.wipe_safety_features']()}</strong>
                        </p>
                        <ul class="text-xs text-muted-foreground space-y-1 mt-1">
                            <li>• {m['admin.wipe_backup_created']()}</li>
                            <li>• {m['admin.wipe_backup_downloaded']()}</li>
                        </ul>
                    </div>
                    <p class="text-xs text-destructive font-medium">
                        {m['admin.wipe_cannot_be_undone']()}
                    </p>
                </div>
            </div>
        </div>
        {#snippet footer()}
            <Button variant="outline" onclick={() => (open = false)}>{m['common.cancel']()}</Button>
            <Button variant="destructive" onclick={onConfirm} disabled={busy}>
                {busy ? m['admin.wiping_database']() : m['admin.wipe_all_data']()}
            </Button>
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
