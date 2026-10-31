<script lang="ts">
    import type { Component } from 'svelte';
    import { Download, FileDown, HardDrive, Trash, Upload } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { backupKind, backupTypeLabel } from '#lib/components/admin/backups/backup-type.js';
    import { formatDateTime, formatFileSize } from '#lib/utils/format.js';
    import type { BackupFileDTO } from '#lib/shared/dto.js';

    /** The automatic or the manual files of the backup page, with a filter by kind. */
    let {
        title,
        icon: Icon,
        tone,
        files,
        empty,
        busy,
        onDownload,
        onRestore,
        onDelete
    }: {
        title: string;
        icon: Component<{ class?: string }>;
        /** The look of the list: the theme's colour for the automatic files, muted for the manual ones. */
        tone: 'primary' | 'muted';
        files: BackupFileDTO[];
        /** What the list says while it has no file at all. */
        empty: string;
        /** True while a job runs, which leaves the restore and delete buttons disabled. */
        busy: boolean;
        onDownload: (file: BackupFileDTO) => void;
        onRestore: (file: BackupFileDTO) => void;
        onDelete: (file: BackupFileDTO) => void;
    } = $props();

    const kindId = $props.id();
    let kind = $state<'all' | 'backup' | 'export'>('all');
    const backups = $derived(files.filter((file) => !file.isExport));
    const exports = $derived(files.filter((file) => file.isExport));
    const shown = $derived(kind === 'all' ? files : kind === 'backup' ? backups : exports);
    const withCount = (label: string, count: number) => `${label} (${count})`;
    const kindOptions = $derived([
        { value: 'all' as const, label: withCount(m['common.all'](), files.length) },
        { value: 'backup' as const, label: withCount(m['admin.full_backup'](), backups.length) },
        { value: 'export' as const, label: withCount(m['admin.full_export'](), exports.length) }
    ]);
    const toneClasses = {
        primary: { icon: 'text-primary', row: 'bg-primary/5' },
        muted: { icon: 'text-muted-foreground', row: 'bg-muted/50' }
    };
</script>

<section class="min-w-0 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-sm font-medium">
            <Icon class="h-4 w-4 {toneClasses[tone].icon}" />
            {title}
            <Badge variant="secondary" class="text-xs">{shown.length}</Badge>
        </h2>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <label for={kindId}>{m['admin.show']()}</label>
            <OptionSelect
                id={kindId}
                bind:value={kind}
                size="sm"
                class="w-auto text-xs"
                options={kindOptions}
            />
        </div>
    </div>

    {#if shown.length === 0}
        <p
            class="rounded-lg border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground"
        >
            {files.length === 0 ? empty : m['admin.no_backups_of_this_kind']()}
        </p>
    {:else}
        <ul class="max-h-96 space-y-2 overflow-y-auto">
            {#each shown as file (file.filename)}
                {@const fileKind = backupKind(file)}
                <li
                    class="flex items-center justify-between gap-2 rounded-lg border p-3 {toneClasses[
                        tone
                    ].row}"
                >
                    <div class="min-w-0 flex-1">
                        <div class="mb-1 flex items-center gap-2">
                            {#if file.isExport}
                                <FileDown class="h-4 w-4 shrink-0 {toneClasses[tone].icon}" />
                            {:else}
                                <HardDrive class="h-4 w-4 shrink-0 {toneClasses[tone].icon}" />
                            {/if}
                            <Badge
                                variant={file.isAutomatic ? 'default' : 'outline'}
                                class="text-xs"
                            >
                                {backupTypeLabel(file)}
                            </Badge>
                        </div>
                        <p class="truncate text-sm font-medium" title={file.filename}>
                            {file.filename}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • {formatDateTime(file.created)}
                        </p>
                    </div>
                    <div class="flex shrink-0 gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onclick={() => onDownload(file)}
                            title={m['admin.download_backup']({ kind: fileKind })}
                            aria-label={m['admin.download_backup']({ kind: fileKind })}
                        >
                            <Download class="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onclick={() => onRestore(file)}
                            title={file.isExport
                                ? m['admin.import_data_from_zip_export']()
                                : m['admin.restore_database_from_backup']()}
                            aria-label={file.isExport
                                ? m['admin.import_data_from_zip_export']()
                                : m['admin.restore_database_from_backup']()}
                        >
                            <Upload class="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onclick={() => onDelete(file)}
                            title={m['admin.delete_backup']({ kind: fileKind })}
                            aria-label={m['admin.delete_backup']({ kind: fileKind })}
                        >
                            <Trash class="h-4 w-4" />
                        </Button>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</section>
