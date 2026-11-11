<script lang="ts">
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import ScrollRegion from '#lib/components/layout/ScrollRegion.svelte';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { FileUp, X, ChevronUp, ChevronDown, FileArchive } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { CSV_TABLE_TEXTS, csvDelimiterOptions } from '#lib/components/admin/csv-tables.js';
    import type { CsvImportTableDTO } from '#lib/shared/dto.js';

    let {
        open = $bindable(false),
        tables,
        onConfirm
    }: {
        open: boolean;
        /** The tables of the import, in its order, as the server reads them. */
        tables: CsvImportTableDTO[];
        /** Checks the files, which the review then shows before anything is written. */
        onConfirm: (files: File[], delimiter: string) => void;
    } = $props();

    let csvImportFiles = $state<File[]>([]);
    let csvImportDelimiter = $state(',');
    let csvFileInput = $state<HTMLInputElement>();
    let showCsvImportHelp = $state(false);
    // The button is greyed without a file: a line above it says why.
    const filesMissingId = $props.id();

    function closeDialog() {
        open = false;
        csvImportFiles = [];
        if (csvFileInput) {
            csvFileInput.value = '';
        }
    }

    function triggerCsvFileInput() {
        csvFileInput?.click();
    }

    function handleCsvFileSelection(event: Event) {
        const target = event.target as HTMLInputElement;
        const files = target.files;

        if (!files) return;

        const invalidFiles = Array.from(files).filter(
            (file) => !file.name.toLowerCase().endsWith('.csv')
        );
        if (invalidFiles.length > 0) {
            toasts.add(
                m['toast.invalid_csv_files']({
                    files: invalidFiles.map((file) => file.name).join(', ')
                })
            );
            target.value = '';
            return;
        }

        csvImportFiles = Array.from(files);
    }

    function removeCsvFile(index: number) {
        csvImportFiles = csvImportFiles.filter((_, i) => i !== index);
        if (csvFileInput && csvImportFiles.length === 0) {
            csvFileInput.value = '';
        }
    }

    function checkFiles() {
        if (csvImportFiles.length === 0) return;

        const files = csvImportFiles;
        closeDialog();
        onConfirm(files, csvImportDelimiter);
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <ScrollingDialogContent title={m['admin.csv_import']()} class="max-w-2xl">
        <div class="space-y-6 py-3">
            <div class="space-y-3">
                <Label class="text-base font-medium"
                    >{m['admin.select_csv_files_to_import']()}</Label
                >
                <div class="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <Button onclick={triggerCsvFileInput} variant="outline">
                        <FileUp class="h-4 w-4 mr-2" />
                        {m['admin.select_csv_files']()}
                    </Button>
                    <p class="text-xs text-muted-foreground mt-2">
                        {m['admin.select_csv_files_instruction']()}
                    </p>
                </div>
                <input
                    bind:this={csvFileInput}
                    type="file"
                    accept=".csv"
                    multiple
                    onchange={handleCsvFileSelection}
                    style="display: none;"
                />
            </div>

            {#if csvImportFiles.length > 0}
                <div class="space-y-2">
                    <Label class="text-sm font-medium"
                        >{m['admin.csv_selected_files_count']({
                            count: csvImportFiles.length
                        })}</Label
                    >
                    <div class="border rounded-md p-3 max-h-40 overflow-y-auto space-y-1">
                        {#each csvImportFiles as file, index (file)}
                            <div
                                class="flex items-center justify-between text-sm bg-muted/30 rounded p-2"
                            >
                                <span class="truncate">{file.name}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onclick={() => removeCsvFile(index)}
                                    class="h-6 w-6 p-0"
                                    aria-label={m['admin.remove_file']({ name: file.name })}
                                >
                                    <X class="h-3 w-3" />
                                </Button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- CSV Import Help Section -->
            <div class="border rounded-lg">
                <Button
                    variant="ghost"
                    class="w-full flex items-center justify-between p-4 h-auto font-medium text-left"
                    onclick={() => (showCsvImportHelp = !showCsvImportHelp)}
                >
                    <span>📚 {m['admin.csv_file_format_guide']()}</span>
                    {#if showCsvImportHelp}
                        <ChevronUp class="h-4 w-4" />
                    {:else}
                        <ChevronDown class="h-4 w-4" />
                    {/if}
                </Button>

                {#if showCsvImportHelp}
                    <div class="px-4 pb-4 space-y-4">
                        <p class="text-sm text-muted-foreground">
                            {m['admin.csv_guide_description']()}
                        </p>

                        <ScrollRegion
                            label={m['admin.csv_file_format_guide']()}
                            class="space-y-3 max-h-80"
                        >
                            {#each tables as config (config.table)}
                                {@const texts = CSV_TABLE_TEXTS[config.table]}
                                <div class="border rounded p-3 bg-muted/30">
                                    <div class="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 class="font-medium text-sm">{texts.label()}</h3>
                                            <p class="text-xs text-muted-foreground">
                                                {texts.description()}
                                            </p>
                                        </div>
                                        <Badge variant="outline" class="text-xs">
                                            {m['admin.csv_priority']()}
                                            {config.priority}
                                        </Badge>
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-xs font-medium text-muted-foreground">
                                            {m['admin.csv_filename_must_contain']()}
                                            <code class="bg-muted px-1 rounded">{config.table}</code
                                            >
                                            {m['admin.csv_anywhere_in_name']()}
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            {m['admin.csv_examples']()}
                                            <code class="bg-muted px-1 rounded"
                                                >{`${config.table}.csv`}</code
                                            >,
                                            <code class="bg-muted px-1 rounded"
                                                >{`2024-${config.table}.csv`}</code
                                            >
                                        </p>
                                        <div class="text-xs">
                                            <span class="font-medium text-muted-foreground"
                                                >{m['admin.csv_columns']()}
                                            </span>
                                            <div class="flex flex-wrap gap-1 mt-1">
                                                {#each config.columns as column (column.name)}
                                                    <code
                                                        class="bg-muted px-1.5 py-0.5 rounded text-xs {column.required
                                                            ? ''
                                                            : 'text-muted-foreground'}"
                                                        title={column.required
                                                            ? m['admin.csv_required_field']()
                                                            : m['admin.csv_optional_field']()}
                                                    >
                                                        {column.name}{column.required ? '' : '?'}
                                                    </code>
                                                {/each}
                                            </div>
                                        </div>
                                        {#if texts.note}
                                            <p class="text-xs text-muted-foreground">
                                                {texts.note()}
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </ScrollRegion>

                        <div class="text-xs text-muted-foreground bg-primary/10 p-3 rounded">
                            <strong>{m['admin.csv_note']()}</strong>
                            {m['admin.csv_guide_note']()}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- ZIP Import Reminder (outside the collapsible guide) -->
            <div class="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div class="flex items-start gap-3">
                    <FileArchive class="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                        <p class="font-medium text-warning mb-2">
                            {m['admin.dont_forget_your_images']()}
                        </p>
                        <p class="text-sm text-foreground">
                            {m['admin.after_importing_csv_data']()}
                            <strong>{m['admin.import_images_from_zip']()}</strong>
                            {m['admin.feature_in_images_tab']()}
                        </p>
                    </div>
                </div>
            </div>

            <div class="space-y-2">
                <Label for="csv-import-delimiter">{m['admin.delimiter']()}</Label>
                <OptionSelect
                    id="csv-import-delimiter"
                    bind:value={csvImportDelimiter}
                    options={csvDelimiterOptions()}
                />
                <p class="text-xs text-muted-foreground">
                    {m['admin.character_used_to_separate_fields']()}
                </p>
            </div>

            <div class="bg-warning/10 p-4 rounded-lg">
                <h3 class="text-sm font-medium text-warning mb-2">
                    {m['admin.import_notes']()}
                </h3>
                <ul class="text-xs text-foreground space-y-1">
                    <li>• {m['admin.import_only_add_new_records']()}</li>
                    <li>• {m['admin.ids_auto_generated']()}</li>
                    <li>• {m['admin.file_names_should_contain_table']()}</li>
                    <li>• {m['admin.csv_review_note']()}</li>
                </ul>
            </div>
        </div>

        {#snippet footer()}
            {#if csvImportFiles.length === 0}
                <p id={filesMissingId} class="basis-full text-end text-xs text-muted-foreground">
                    {m['admin.csv_files_missing']()}
                </p>
            {/if}
            <Button variant="outline" onclick={closeDialog}>
                {m['common.cancel']()}
            </Button>
            <Button
                onclick={checkFiles}
                disabled={csvImportFiles.length === 0}
                aria-describedby={csvImportFiles.length === 0 ? filesMissingId : undefined}
            >
                {m['admin.csv_check_files']({ count: csvImportFiles.length })}
            </Button>
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
