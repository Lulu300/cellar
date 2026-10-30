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
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { Clock } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import type { BackupSettingsDTO, BackupTokenDTO } from '#lib/shared/dto.js';

    let {
        open = $bindable(false),
        settings
    }: {
        open: boolean;
        /** The saved settings, which the form starts from. */
        settings: BackupSettingsDTO;
    } = $props();

    // Filled from `settings` each time the dialog opens.
    let form = $state({
        autoBackupEnabled: false,
        autoBackupInterval: 24,
        autoBackupKeepCount: 7,
        autoBackupMode: 'internal'
    });
    let error = $state('');
    let saving = $state(false);
    // Shown once, then forgotten: the server keeps only its hash.
    let cronToken = $state('');
    let isGeneratingToken = $state(false);
    // A token made since the dialog opened counts before the page's data is reloaded.
    let hasBackupToken = $derived(settings.hasBackupToken || cronToken !== '');

    // The Content-Type is not optional: SvelteKit refuses a POST without one from another origin.
    let cronCommand = $derived(
        `curl -fsS -X POST -H 'Authorization: Bearer ${cronToken}' -H 'Content-Type: application/json' ${window.location.origin}/api/admin/auto-backup`
    );

    $effect(() => {
        if (!open) return;
        const { autoBackupEnabled, autoBackupInterval, autoBackupKeepCount, autoBackupMode } =
            settings;
        form = { autoBackupEnabled, autoBackupInterval, autoBackupKeepCount, autoBackupMode };
        error = '';
        cronToken = '';
    });

    async function generateCronToken() {
        error = '';
        isGeneratingToken = true;
        try {
            cronToken = (
                await request<BackupTokenDTO>('/api/admin/backup-token', { method: 'POST' })
            ).token;
        } catch {
            error = m['admin.cron_token_failed']();
        } finally {
            isGeneratingToken = false;
        }
    }

    // The server checks the ranges and says what is wrong.
    async function save() {
        error = '';
        saving = true;
        try {
            await request('/api/admin/backup-settings', { method: 'PUT', json: form });
            toasts.add(m['toast.backup_settings_saved'](), 'success');
            open = false;
            await invalidateAll();
        } catch (failure) {
            error = errorMessage(failure);
        } finally {
            saving = false;
        }
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader class="flex-shrink-0">
            <DialogTitle>{m['admin.backup_settings_dialog']()}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4 flex-1 overflow-y-auto">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                >
                    <Clock class="h-5 w-5 text-primary" />
                </div>
                <div class="flex-1">
                    <p class="text-sm text-muted-foreground mb-4">
                        {m['admin.backup_settings_description']()}
                    </p>
                    <div class="space-y-4">
                        <div class="flex items-center space-x-2">
                            <input
                                id="auto-backup-enabled"
                                type="checkbox"
                                bind:checked={form.autoBackupEnabled}
                                class="rounded border-input"
                            />
                            <Label for="auto-backup-enabled"
                                >{m['admin.enable_auto_backup']()}</Label
                            >
                        </div>

                        <div class="space-y-2">
                            <Label for="backup-interval">{m['admin.backup_interval_hours']()}</Label
                            >
                            <Input
                                id="backup-interval"
                                type="number"
                                bind:value={form.autoBackupInterval}
                                min="1"
                                max="168"
                                placeholder={m['placeholders.session_timeout_example']()}
                                class="w-full"
                                disabled={!form.autoBackupEnabled}
                            />
                            <p class="text-xs text-muted-foreground">
                                {m['admin.backup_interval_help']()}
                            </p>
                        </div>

                        <div class="space-y-2">
                            <Label for="backup-keep-count">{m['admin.keep_backup_count']()}</Label>
                            <Input
                                id="backup-keep-count"
                                type="number"
                                bind:value={form.autoBackupKeepCount}
                                min="1"
                                max="50"
                                placeholder="7"
                                class="w-full"
                                disabled={!form.autoBackupEnabled}
                            />
                            <p class="text-xs text-muted-foreground">
                                {m['admin.keep_backup_count_help']()}
                            </p>
                        </div>

                        <div class="space-y-2">
                            <Label for="backup-mode">{m['admin.backup_mode']()}</Label>
                            <OptionSelect
                                id="backup-mode"
                                bind:value={form.autoBackupMode}
                                options={[
                                    { value: 'internal', label: m['admin.internal_scheduler']() },
                                    { value: 'cron', label: m['admin.external_cron_job']() }
                                ]}
                                disabled={!form.autoBackupEnabled}
                            />
                        </div>

                        {#if form.autoBackupEnabled && form.autoBackupMode === 'cron'}
                            <div class="space-y-2 rounded-md border p-3">
                                <p class="text-xs text-muted-foreground">
                                    {m['admin.cron_mode_help']()}
                                </p>
                                {#if cronToken}
                                    <p class="text-xs font-medium">
                                        {m['admin.cron_token_shown_once']()}
                                    </p>
                                    <code
                                        class="block select-all break-all rounded bg-muted p-2 text-xs"
                                        >{cronCommand}</code
                                    >
                                {:else}
                                    <p class="text-xs">
                                        {hasBackupToken
                                            ? m['admin.cron_token_exists']()
                                            : m['admin.cron_token_missing']()}
                                    </p>
                                {/if}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onclick={generateCronToken}
                                    disabled={isGeneratingToken}
                                >
                                    {hasBackupToken
                                        ? m['admin.regenerate_cron_token']()
                                        : m['admin.generate_cron_token']()}
                                </Button>
                            </div>
                        {/if}

                        {#if error}
                            <p class="text-sm text-destructive">{error}</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
        <div class="flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" onclick={() => (open = false)}>
                {m['common.cancel']()}
            </Button>
            <Button onclick={save} disabled={saving}>{m['common.save']()}</Button>
        </div>
    </DialogContent>
</Dialog>
