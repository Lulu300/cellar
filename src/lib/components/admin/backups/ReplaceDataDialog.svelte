<script lang="ts">
    import { CircleAlert, FileUp, Upload } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { formatFileSize } from '#lib/utils/format.js';

    /**
     * Confirms that a backup replaces the database (restore) or that an export replaces the data
     * (import), from a file the user chose or one of the list; the page does it.
     */
    let {
        open = $bindable(false),
        kind,
        filename,
        size,
        busy,
        onConfirm
    }: {
        open: boolean;
        kind: 'restore' | 'import';
        filename: string;
        size: number;
        busy: boolean;
        onConfirm: () => void;
    } = $props();

    const Icon = $derived(kind === 'restore' ? Upload : FileUp);
</script>

<Dialog bind:open>
    <ScrollingDialogContent
        title={kind === 'restore' ? m['admin.database_restore']() : m['admin.import_from_export']()}
        icon={CircleAlert}
        iconClass="text-warning"
        class="max-w-md"
    >
        <div class="flex items-start gap-3 py-4">
            <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10"
            >
                <Icon class="h-5 w-5 text-warning" />
            </div>
            <div class="min-w-0 flex-1 space-y-4">
                <p class="text-sm text-foreground">
                    {kind === 'restore'
                        ? m['admin.warning_restore_database']()
                        : m['admin.warning_replace_all_data']()}
                </p>
                <div class="rounded-lg bg-muted/50 p-3">
                    <p class="font-mono text-sm break-all">{filename}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{formatFileSize(size)}</p>
                </div>
                <div class="rounded-lg bg-success/10 p-3 text-sm text-success">
                    <p class="mb-2 font-medium">{m['admin.safety_title']()}</p>
                    <ul class="list-disc space-y-1 pl-4 text-xs">
                        <li>{m['admin.safety_backup_first']()}</li>
                        {#if kind === 'import'}
                            <li>{m['admin.safety_import_checked']()}</li>
                        {/if}
                    </ul>
                </div>
            </div>
        </div>
        {#snippet footer()}
            <Button variant="outline" onclick={() => (open = false)}>{m['common.cancel']()}</Button>
            <Button variant="destructive" onclick={onConfirm} disabled={busy}>
                {#if kind === 'restore'}
                    {busy ? m['admin.restoring']() : m['admin.restore_database']()}
                {:else}
                    {busy ? m['admin.importing']() : m['admin.import_data']()}
                {/if}
            </Button>
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
