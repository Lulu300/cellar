<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { invalidateAll } from '$app/navigation';
    import { Archive, Clock, RefreshCw, Settings } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import BackupActions, {
        type BackupJob
    } from '#lib/components/admin/backups/BackupActions.svelte';
    import BackupList from '#lib/components/admin/backups/BackupList.svelte';
    import { backupKind } from '#lib/components/admin/backups/backup-type.js';
    import NameBackupDialog from '#lib/components/admin/backups/NameBackupDialog.svelte';
    import ReplaceDataDialog from '#lib/components/admin/backups/ReplaceDataDialog.svelte';
    import WipeDialog from '#lib/components/admin/backups/WipeDialog.svelte';
    import BackupSettingsDialog from '#lib/components/admin/dialogs/BackupSettingsDialog.svelte';
    import BarcodeOverrideDialog from '#lib/components/admin/dialogs/BarcodeOverrideDialog.svelte';
    import CsvExportDialog from '#lib/components/admin/dialogs/CsvExportDialog.svelte';
    import CsvImportDialog from '#lib/components/admin/dialogs/CsvImportDialog.svelte';
    import CsvReviewDialog from '#lib/components/admin/csv-review/CsvReviewDialog.svelte';
    import type { CsvImportRequest } from '#lib/components/admin/csv-review/csv-review.svelte.js';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { Jobs } from '#lib/components/admin/jobs.svelte.js';
    import {
        downloadBackup,
        savePreviousData
    } from '#lib/components/admin/backups/backup-downloads.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { tableOfFile } from '#lib/shared/csv-import.js';
    import type {
        BackupCreatedDTO,
        BackupFileDTO,
        ExportCreatedDTO,
        JsonImportDTO,
        RestoreDTO,
        WipeDTO
    } from '#lib/shared/dto.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const jobs = new Jobs<BackupJob>();
    const automatic = $derived(data.backups.filter((file) => file.isAutomatic));
    const manual = $derived(data.backups.filter((file) => !file.isAutomatic));

    let naming = $state<'backup' | 'export'>('backup');
    let showNaming = $state(false);
    // What a restore or an import would replace the data with: a file chosen, or one of the list.
    let replacement = $state<{ kind: 'restore' | 'import'; file: File | BackupFileDTO } | null>(
        null
    );
    let showReplace = $state(false);
    let showWipe = $state(false);
    let showSettings = $state(false);
    let showCsvExport = $state(false);
    let showCsvImport = $state(false);
    let pendingCsv = $state<{ files: File[]; delimiter: string } | null>(null);
    let showBarcodeOverride = $state(false);
    let csvReview = $state<CsvImportRequest | null>(null);
    let showCsvReview = $state(false);

    function startNaming(kind: 'backup' | 'export') {
        naming = kind;
        showNaming = true;
    }

    const create = (kind: 'backup' | 'export', name: string) =>
        jobs.run(kind, async () => {
            const json = { name: name || undefined };
            try {
                if (kind === 'backup') {
                    const { restorable } = await request<BackupCreatedDTO>(
                        '/api/admin/create-backup',
                        { method: 'POST', json }
                    );
                    toasts.add(m['toast.full_backup_created'](), 'success');
                    if (!restorable) toasts.add(m['toast.backup_too_large'](), 'warning', 0);
                } else {
                    const { recordCount, restorable } = await request<ExportCreatedDTO>(
                        '/api/admin/create-export',
                        { method: 'POST', json }
                    );
                    toasts.add(m['toast.full_export_created']({ count: recordCount }), 'success');
                    if (!restorable) toasts.add(m['toast.export_too_large'](), 'warning', 0);
                }
                showNaming = false;
                await invalidateAll();
            } catch (error) {
                const values = { error: errorMessage(error) };
                toasts.add(
                    kind === 'backup'
                        ? m['toast.failed_to_create_full_backup'](values)
                        : m['toast.failed_to_create_full_export'](values)
                );
            }
        });

    async function remove(file: BackupFileDTO) {
        const kind = backupKind(file);
        const message = m['admin.confirm_delete_backup']({ kind, filename: file.filename });
        if (!(await confirm({ message }))) return;
        try {
            await request('/api/admin/delete-backup', {
                method: 'DELETE',
                json: { filename: file.filename }
            });
            toasts.add(m['toast.backup_deleted']({ kind }), 'success');
            await invalidateAll();
        } catch (error) {
            toasts.add(m['toast.failed_to_delete_backup']({ kind, error: errorMessage(error) }));
        }
    }

    function startReplace(kind: 'restore' | 'import', file: File | BackupFileDTO) {
        replacement = { kind, file };
        showReplace = true;
    }

    const replaceData = () =>
        replacement &&
        jobs.run(replacement.kind, async () => {
            if (!replacement) return;
            const { kind, file } = replacement;
            try {
                // A file of the list stays on the server, which reads it by its name. A file
                // chosen is sent as the raw body, typed application/zip whatever type the
                // browser gave it.
                const result = await request<RestoreDTO | JsonImportDTO>(
                    kind === 'restore' ? '/api/admin/restore' : '/api/admin/import-json',
                    file instanceof File
                        ? { method: 'POST', body: file.slice(0, file.size, 'application/zip') }
                        : { method: 'POST', json: { filename: file.filename } }
                );
                showReplace = false;
                toasts.add(
                    'recordCount' in result
                        ? m['toast.json_import_completed']({ count: result.recordCount })
                        : m['toast.database_restored'](),
                    'success',
                    8000
                );
                if (result.imagesCopyFailed) {
                    toasts.add(
                        kind === 'restore'
                            ? m['toast.restore_images_failed']()
                            : m['toast.import_images_failed'](),
                        'error',
                        10000
                    );
                }
                await savePreviousData(result.backup);
            } catch (error) {
                const values = { error: errorMessage(error) };
                toasts.add(
                    kind === 'restore'
                        ? m['toast.failed_to_restore_database'](values)
                        : m['toast.failed_to_import_export'](values),
                    'error',
                    10000
                );
            }
        });

    const wipe = () =>
        jobs.run('wipe', async () => {
            try {
                const result = await request<WipeDTO>('/api/admin/wipe-database', {
                    method: 'POST'
                });
                showWipe = false;
                toasts.add(m['toast.database_wiped'](), 'success', 8000);
                await savePreviousData(result.backup);
            } catch (error) {
                toasts.add(m['toast.failed_to_wipe_database']({ error: errorMessage(error) }));
            }
        });

    // Whether the import holds bottles, by the tables that the server reads from the file names.
    const holdsBottles = (files: File[]) => {
        const tables = data.csvTables.map(({ table }) => table);
        return files.some((file) => tableOfFile(file.name, tables) === 'wineBottles');
    };

    function startCsvImport(files: File[], delimiter: string) {
        // Automatic barcodes: the user chooses whether the bottles keep those of the file.
        if (data.barcodeAutoGeneration && holdsBottles(files)) {
            pendingCsv = { files, delimiter };
            showBarcodeOverride = true;
            return;
        }
        reviewCsv({ files, delimiter }, false);
    }

    function reviewCsv(
        { files, delimiter }: { files: File[]; delimiter: string },
        overrideAllBarcodes: boolean
    ) {
        csvReview = { files, delimiter, overrideAllBarcodes };
        showCsvReview = true;
    }
</script>

<svelte:head>
    <title>{pageTitle(m['admin.section_backups'](), m['admin.title']())}</title>
</svelte:head>

<div class="space-y-6">
    <BackupActions
        running={jobs.running}
        onBackup={() => startNaming('backup')}
        onExport={() => startNaming('export')}
        onCsvExport={() => (showCsvExport = true)}
        onCsvImport={() => (showCsvImport = true)}
        onRestoreFile={(file) => startReplace('restore', file)}
        onImportFile={(file) => startReplace('import', file)}
        onWipe={() => (showWipe = true)}
    />

    <Card>
        <CardHeader>
            <CardTitle class="flex flex-wrap items-center justify-between gap-2">
                <span class="flex items-center gap-2">
                    <Archive class="h-5 w-5" />
                    {m['admin.backup_management']()}
                </span>
                <span class="flex flex-wrap gap-2">
                    <Button onclick={() => (showSettings = true)} size="sm" variant="outline">
                        <Settings class="h-4 w-4 mr-2" />
                        {m['admin.auto_backup_settings']()}
                    </Button>
                    <Button onclick={() => invalidateAll()} size="sm" variant="outline">
                        <RefreshCw class="h-4 w-4 mr-2" />
                        {m['admin.refresh']()}
                    </Button>
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-6 md:grid-cols-2">
            <BackupList
                title={m['admin.automatic_backups']()}
                icon={Clock}
                tone="primary"
                files={automatic}
                empty={m['admin.no_automatic_backups_yet']()}
                busy={jobs.running !== null}
                onDownload={downloadBackup}
                onRestore={(file) => startReplace(file.isExport ? 'import' : 'restore', file)}
                onDelete={remove}
            />
            <BackupList
                title={m['admin.manual_backups']()}
                icon={Archive}
                tone="muted"
                files={manual}
                empty={m['admin.no_manual_backups_yet']()}
                busy={jobs.running !== null}
                onDownload={downloadBackup}
                onRestore={(file) => startReplace(file.isExport ? 'import' : 'restore', file)}
                onDelete={remove}
            />
        </CardContent>
    </Card>
</div>

<NameBackupDialog
    bind:open={showNaming}
    kind={naming}
    busy={jobs.running === naming}
    onCreate={(name) => create(naming, name)}
/>
{#if replacement}
    <ReplaceDataDialog
        bind:open={showReplace}
        kind={replacement.kind}
        filename={replacement.file instanceof File
            ? replacement.file.name
            : replacement.file.filename}
        size={replacement.file.size}
        busy={jobs.running === replacement.kind}
        onConfirm={replaceData}
    />
{/if}
<WipeDialog bind:open={showWipe} busy={jobs.running === 'wipe'} onConfirm={wipe} />
<BackupSettingsDialog bind:open={showSettings} settings={data.backupSettings} />
<CsvExportDialog bind:open={showCsvExport} />
<CsvImportDialog bind:open={showCsvImport} tables={data.csvTables} onConfirm={startCsvImport} />
<BarcodeOverrideDialog
    bind:open={showBarcodeOverride}
    onConfirm={async (override) => {
        if (pendingCsv) reviewCsv(pendingCsv, override);
        pendingCsv = null;
    }}
/>
<CsvReviewDialog bind:open={showCsvReview} request={csvReview} onImported={() => invalidateAll()} />
