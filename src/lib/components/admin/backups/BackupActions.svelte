<script lang="ts" module>
    export type BackupJob = 'backup' | 'export' | 'csv-import' | 'restore' | 'import' | 'wipe';
</script>

<script lang="ts">
    import type { Component } from 'svelte';
    import {
        Download,
        FileDown,
        FileUp,
        HardDrive,
        LoaderCircle,
        Trash,
        Upload
    } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { toasts } from '#lib/stores/toast.svelte.js';

    /** The operations of the backup page. The page runs them, one at a time: `running`. */
    let {
        running,
        onBackup,
        onExport,
        onCsvExport,
        onCsvImport,
        onRestoreFile,
        onImportFile,
        onWipe
    }: {
        running: BackupJob | null;
        onBackup: () => void;
        onExport: () => void;
        onCsvExport: () => void;
        onCsvImport: () => void;
        onRestoreFile: (file: File) => void;
        onImportFile: (file: File) => void;
        onWipe: () => void;
    } = $props();

    interface Tile {
        title: string;
        description: string;
        label: string;
        /** The job the button starts, whose run it shows with `busyLabel`. */
        job?: BackupJob;
        busyLabel?: string;
        icon: Component<{ class?: string }>;
        onclick: () => void;
        tone: string;
        variant: 'default' | 'outline' | 'destructive';
        wide?: boolean;
    }

    const plain = 'bg-muted/30';
    const csv = 'bg-primary/10';
    const tiles: Tile[] = $derived([
        {
            title: m['admin.full_backup'](),
            description: m['admin.full_backup_description'](),
            label: m['admin.full_backup'](),
            job: 'backup',
            busyLabel: m['admin.creating'](),
            icon: HardDrive,
            onclick: onBackup,
            tone: plain,
            variant: 'default'
        },
        {
            title: m['admin.full_export'](),
            description: m['admin.full_export_description'](),
            label: m['admin.full_export'](),
            job: 'export',
            busyLabel: m['admin.creating'](),
            icon: FileDown,
            onclick: onExport,
            tone: plain,
            variant: 'outline'
        },
        {
            title: m['admin.csv_export'](),
            description: m['admin.csv_export_description'](),
            label: m['admin.csv_export'](),
            icon: FileDown,
            onclick: onCsvExport,
            tone: csv,
            variant: 'outline'
        },
        {
            title: m['admin.csv_import'](),
            description: m['admin.csv_import_description'](),
            label: m['admin.csv_import'](),
            job: 'csv-import',
            busyLabel: m['admin.importing'](),
            icon: FileUp,
            onclick: onCsvImport,
            tone: csv,
            variant: 'outline'
        },
        {
            title: m['admin.database_restore'](),
            description: m['admin.restore_from_zip_backup'](),
            label: m['admin.restore_zip'](),
            job: 'restore',
            busyLabel: m['admin.restoring'](),
            icon: Upload,
            onclick: () => restoreInput?.click(),
            tone: plain,
            variant: 'outline'
        },
        {
            title: m['admin.import_from_export'](),
            description: m['admin.import_wine_data_from_zip'](),
            label: m['admin.import_from_export'](),
            job: 'import',
            busyLabel: m['admin.importing'](),
            icon: FileUp,
            onclick: () => importInput?.click(),
            tone: plain,
            variant: 'outline'
        },
        {
            title: m['admin.complete_database_wipe'](),
            description: m['admin.permanently_delete_warning'](),
            label: m['admin.wipe_all_data'](),
            job: 'wipe',
            busyLabel: m['admin.wiping_database'](),
            icon: Trash,
            onclick: onWipe,
            tone: 'border-destructive/30 bg-destructive/10',
            variant: 'destructive',
            wide: true
        }
    ]);

    let restoreInput = $state<HTMLInputElement>();
    let importInput = $state<HTMLInputElement>();

    /** Passes on the zip the user chose, or says that the file is not one. */
    function takeZip(input: HTMLInputElement, use: (file: File) => void, notZip: string) {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (file.name.toLowerCase().endsWith('.zip')) use(file);
        else toasts.add(notZip);
    }
</script>

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <Download class="h-5 w-5" />
            {m['admin.backup_restore']()}
        </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
        {#each tiles as tile (tile.title)}
            <div
                class="flex flex-col gap-3 rounded-lg border p-4 {tile.tone} {tile.wide
                    ? 'md:col-span-2'
                    : ''}"
            >
                <div class="flex-1">
                    <h2 class="text-sm font-medium">{tile.title}</h2>
                    <p class="mt-1 text-sm text-muted-foreground">{tile.description}</p>
                </div>
                <Button
                    onclick={tile.onclick}
                    disabled={running !== null}
                    size="sm"
                    variant={tile.variant}
                    class="w-full"
                >
                    {#if tile.job && running === tile.job}
                        <LoaderCircle class="h-4 w-4 mr-2 animate-spin" />
                        {tile.busyLabel}
                    {:else}
                        <tile.icon class="h-4 w-4 mr-2" />
                        {tile.label}
                    {/if}
                </Button>
            </div>
        {/each}
        <input
            bind:this={restoreInput}
            type="file"
            accept=".zip"
            class="hidden"
            onchange={(event) =>
                takeZip(event.currentTarget, onRestoreFile, m['toast.invalid_backup_file']())}
        />
        <input
            bind:this={importInput}
            type="file"
            accept=".zip"
            class="hidden"
            onchange={(event) =>
                takeZip(event.currentTarget, onImportFile, m['toast.invalid_export_file']())}
        />
    </CardContent>
</Card>
