<script lang="ts">
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { Archive } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import type { CsvExportDTO } from '#lib/shared/dto.js';
    import { saveBlob } from '#lib/utils/download.js';
    import { CSV_TABLE_TEXTS, csvDelimiterOptions } from '#lib/components/admin/csv-tables.js';

    let { open = $bindable(false) }: { open: boolean } = $props();

    let csvExportTables = $state<string[]>([]);
    let csvExportCustomName = $state('');
    let csvExportDelimiter = $state(',');
    let csvExportError = $state('');
    let isExportingCsv = $state(false);

    function closeDialog() {
        open = false;
        csvExportTables = [];
        csvExportCustomName = '';
        csvExportError = '';
    }

    function toggleCsvExportTable(table: string) {
        if (csvExportTables.includes(table)) {
            csvExportTables = csvExportTables.filter((t) => t !== table);
        } else {
            csvExportTables = [...csvExportTables, table];
        }
    }

    function selectAllCsvTables() {
        csvExportTables = Object.keys(CSV_TABLE_TEXTS);
    }

    function selectNoCsvTables() {
        csvExportTables = [];
    }

    async function executeCsvExport() {
        if (csvExportTables.length === 0) {
            csvExportError = m['admin.select_tables_first']();
            return;
        }

        try {
            isExportingCsv = true;
            csvExportError = '';
            const result = await request<CsvExportDTO>('/api/admin/export-csv', {
                method: 'POST',
                json: {
                    tables: csvExportTables,
                    customName: csvExportCustomName.trim() || undefined,
                    delimiter: csvExportDelimiter
                }
            });
            for (const [index, file] of result.files.entries()) {
                // Chromium drops the downloads past the tenth that a page starts at once,
                // and an export of every table makes twelve.
                if (index > 0) await new Promise((resolve) => setTimeout(resolve, 200));
                saveBlob(new Blob([file.csv], { type: 'text/csv' }), file.filename);
            }
            toasts.add(
                m['toast.csv_export_completed']({
                    count: result.totalRecords,
                    files: result.files.length
                }),
                'success'
            );
            closeDialog();
        } catch (error) {
            csvExportError = errorMessage(error);
        } finally {
            isExportingCsv = false;
        }
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <ScrollingDialogContent
        title={m['admin.csv_export']()}
        error={csvExportError}
        class="max-w-2xl"
    >
        <div class="space-y-6 py-3">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <Label class="text-base font-medium"
                        >{m['admin.select_tables_to_export']()}</Label
                    >
                    <div class="flex gap-2">
                        <Button size="sm" variant="outline" onclick={selectAllCsvTables}>
                            {m['common.select_all']()}
                        </Button>
                        <Button size="sm" variant="outline" onclick={selectNoCsvTables}>
                            {m['admin.select_none']()}
                        </Button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-md p-4">
                    {#each Object.entries(CSV_TABLE_TEXTS) as [table, { label }] (table)}
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={csvExportTables.includes(table)}
                                onchange={() => toggleCsvExportTable(table)}
                                class="rounded border-input"
                            />
                            <span class="text-sm">{label()}</span>
                        </label>
                    {/each}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="csv-export-name">{m['admin.custom_filename_optional']()}</Label>
                    <Input
                        id="csv-export-name"
                        bind:value={csvExportCustomName}
                        placeholder={m['placeholders.csv_filename_example']()}
                        class="w-full"
                    />
                    <p class="text-xs text-muted-foreground">
                        {m['admin.will_be_used_as_prefix']()}
                    </p>
                </div>
                <div class="space-y-2">
                    <Label for="csv-export-delimiter">{m['admin.delimiter']()}</Label>
                    <OptionSelect
                        id="csv-export-delimiter"
                        bind:value={csvExportDelimiter}
                        options={csvDelimiterOptions()}
                    />
                    <p class="text-xs text-muted-foreground">
                        {m['admin.character_used_to_separate']()}
                    </p>
                </div>
            </div>

            <!-- ZIP Export Reminder -->
            <div class="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <div class="flex items-start gap-3">
                    <Archive class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                        <p class="font-medium mb-2">
                            {m['admin.dont_forget_export_images']()}
                        </p>
                        <p class="text-sm text-muted-foreground">
                            {m['admin.csv_export_images_help']()}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {#snippet footer()}
            <Button variant="outline" onclick={closeDialog}>
                {m['common.cancel']()}
            </Button>
            <Button onclick={executeCsvExport} disabled={isExportingCsv}>
                {isExportingCsv ? m['admin.loading']() : m['admin.export_csv_files']()}
            </Button>
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
