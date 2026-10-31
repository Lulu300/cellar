<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';

    /** Asks for the optional name of a new backup or export; the page creates it. */
    let {
        open = $bindable(false),
        kind,
        busy,
        onCreate
    }: {
        open: boolean;
        kind: 'backup' | 'export';
        busy: boolean;
        onCreate: (name: string) => void;
    } = $props();

    let name = $state('');

    $effect(() => {
        if (open) name = '';
    });

    function create(event: SubmitEvent) {
        event.preventDefault();
        // The server alone checks the name, which is free apart from "auto", "auto-…", "/" and its length.
        onCreate(name.trim());
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>
                {kind === 'backup' ? m['admin.full_backup']() : m['admin.full_export']()}
            </DialogTitle>
        </DialogHeader>
        <form class="space-y-6 py-4" onsubmit={create}>
            <div>
                <Label for="backup-name">{m['admin.custom_filename_optional']()}</Label>
                <Input
                    id="backup-name"
                    bind:value={name}
                    placeholder={kind === 'backup'
                        ? m['placeholders.backup_name_example']()
                        : m['placeholders.export_name_example']()}
                    class="mt-1"
                />
                <p class="text-xs text-muted-foreground mt-1">
                    {m['admin.leave_empty_default_naming']()}
                </p>
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" onclick={() => (open = false)}>
                    {m['common.cancel']()}
                </Button>
                <Button type="submit" disabled={busy}>
                    {#if busy}
                        {m['admin.creating']()}
                    {:else}
                        {kind === 'backup'
                            ? m['admin.create_backup']()
                            : m['admin.create_export']()}
                    {/if}
                </Button>
            </div>
        </form>
    </DialogContent>
</Dialog>
