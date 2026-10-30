<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { ChevronUp, ChevronDown, FileArchive } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { SvelteSet } from 'svelte/reactivity';
    import type { CsvImportDTO } from '#lib/shared/dto.js';
    import { rowProblemsText, skipReasonText } from '#lib/utils/import-problems.js';
    import { CSV_TABLE_TEXTS } from '#lib/components/admin/csv-tables.js';

    let {
        open = $bindable(false),
        csvImportResults = $bindable(null)
    }: {
        open: boolean;
        csvImportResults: CsvImportDTO | null;
    } = $props();

    const expandedErrors = new SvelteSet<string>();

    function closeDialog() {
        open = false;
        csvImportResults = null;
        expandedErrors.clear();
    }

    function toggleErrorExpansion(key: string) {
        if (expandedErrors.has(key)) {
            expandedErrors.delete(key);
        } else {
            expandedErrors.add(key);
        }
    }

    type FileReport = CsvImportDTO['results'][number];

    const titleOf = ({ table, file }: FileReport) =>
        table ? `${CSV_TABLE_TEXTS[table].label()} (${file})` : file;
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <DialogContent class="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader class="flex-shrink-0">
            <DialogTitle>{m['admin.csv_import_results']()}</DialogTitle>
        </DialogHeader>
        <div class="flex-1 overflow-hidden flex flex-col">
            {#if csvImportResults}
                <div class="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {#if csvImportResults.dryRun}
                        <p
                            class="flex-shrink-0 rounded-lg bg-primary/10 p-3 text-sm text-foreground"
                        >
                            {m['admin.csv_dry_run_notice']()}
                        </p>
                    {/if}
                    <!-- Summary -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 flex-shrink-0">
                        <div class="text-center p-3 bg-success/10 rounded-lg">
                            <div class="text-xl font-bold text-success">
                                {csvImportResults.summary?.totalImported || 0}
                            </div>
                            <div class="text-xs text-success">
                                {m['admin.records_imported']()}
                            </div>
                        </div>
                        <div class="text-center p-3 bg-warning/10 rounded-lg">
                            <div class="text-xl font-bold text-warning">
                                {csvImportResults.summary?.totalSkipped || 0}
                            </div>
                            <div class="text-xs text-warning">
                                {m['admin.duplicates_skipped']()}
                            </div>
                        </div>
                        <div class="text-center p-3 bg-destructive/10 rounded-lg">
                            <div class="text-xl font-bold text-destructive">
                                {csvImportResults.summary?.totalFailed || 0}
                            </div>
                            <div class="text-xs text-destructive">
                                {m['admin.records_failed']()}
                            </div>
                        </div>
                        <div class="text-center p-3 bg-primary/10 rounded-lg">
                            <div class="text-xl font-bold text-foreground">
                                {csvImportResults.summary?.filesProcessed || 0}
                            </div>
                            <div class="text-xs text-muted-foreground">
                                {m['admin.files_processed']()}
                            </div>
                        </div>
                    </div>

                    <!-- Results per table -->
                    <div class="flex-1 overflow-y-auto space-y-3 pr-2">
                        {#each csvImportResults.results as result (result.file)}
                            <div class="border rounded-lg p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <h3
                                        class="font-medium text-sm truncate pr-2"
                                        title={titleOf(result)}
                                    >
                                        {titleOf(result)}
                                    </h3>
                                    <div class="flex gap-1 text-xs flex-shrink-0">
                                        <Badge
                                            variant="outline"
                                            class="bg-success/10 text-success border-success/30 px-2 py-0.5"
                                        >
                                            {m['admin.imported']({
                                                count: result.successfulImports
                                            })}
                                        </Badge>
                                        {#if result.skippedImports > 0}
                                            <Badge
                                                variant="outline"
                                                class="bg-warning/10 text-warning border-warning/30 px-2 py-0.5"
                                            >
                                                {m['admin.duplicates']({
                                                    count: result.skippedImports
                                                })}
                                            </Badge>
                                        {/if}
                                        {#if result.failedImports > 0}
                                            <Badge
                                                variant="outline"
                                                class="bg-destructive/10 text-destructive border-destructive/30 px-2 py-0.5"
                                            >
                                                {m['admin.failed']({ count: result.failedImports })}
                                            </Badge>
                                        {/if}
                                    </div>
                                </div>

                                {#if result.errors && result.errors.length > 0}
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <h4 class="text-xs font-medium text-destructive">
                                                {m['admin.errors_count']({
                                                    count: result.failedImports
                                                })}
                                            </h4>
                                            {#if result.errors.length > 5}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    class="h-6 px-2 text-xs"
                                                    onclick={() =>
                                                        toggleErrorExpansion(result.file)}
                                                >
                                                    {#if expandedErrors.has(result.file)}
                                                        <ChevronUp class="h-3 w-3 mr-1" />
                                                        {m['admin.show_less']()}
                                                    {:else}
                                                        <ChevronDown class="h-3 w-3 mr-1" />
                                                        {m['admin.show_all_errors']()}
                                                    {/if}
                                                </Button>
                                            {/if}
                                        </div>
                                        {#if result.failedImports > result.errors.length}
                                            <p class="text-xs text-muted-foreground">
                                                {m['admin.csv_rows_listed_first']({
                                                    count: result.errors.length
                                                })}
                                            </p>
                                        {/if}
                                        <div class="max-h-60 overflow-y-auto space-y-1 rounded p-2">
                                            {#each expandedErrors.has(result.file) ? result.errors : result.errors.slice(0, 5) as error (error.row)}
                                                <div
                                                    class="text-xs bg-destructive/10 p-1.5 rounded break-words"
                                                >
                                                    <!-- Row 0 is the whole file. -->
                                                    {#if error.row > 0}
                                                        <strong class="text-destructive"
                                                            >{m['admin.row_number']({
                                                                row: error.row
                                                            })}</strong
                                                        >
                                                    {/if}
                                                    <span class="text-foreground"
                                                        >{rowProblemsText(error.problems)}</span
                                                    >
                                                </div>
                                            {/each}
                                            {#if !expandedErrors.has(result.file) && result.errors.length > 5}
                                                <div
                                                    class="text-xs text-muted-foreground text-center py-1"
                                                >
                                                    {m['admin.more_errors_click_show_all']({
                                                        count: result.errors.length - 5
                                                    })}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/if}

                                {#if result.skipped && result.skipped.length > 0}
                                    <div class="space-y-2 mt-2">
                                        <div class="flex items-center justify-between">
                                            <h4 class="text-xs font-medium text-warning">
                                                {m['admin.duplicates_skipped_count']({
                                                    count: result.skippedImports
                                                })}
                                            </h4>
                                            {#if result.skipped.length > 5}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    class="h-6 px-2 text-xs"
                                                    onclick={() =>
                                                        toggleErrorExpansion(
                                                            `skipped-${result.file}`
                                                        )}
                                                >
                                                    {#if expandedErrors.has(`skipped-${result.file}`)}
                                                        <ChevronUp class="h-3 w-3 mr-1" />
                                                        {m['admin.show_less']()}
                                                    {:else}
                                                        <ChevronDown class="h-3 w-3 mr-1" />
                                                        {m['admin.show_all_errors']()}
                                                    {/if}
                                                </Button>
                                            {/if}
                                        </div>
                                        {#if result.skippedImports > result.skipped.length}
                                            <p class="text-xs text-muted-foreground">
                                                {m['admin.csv_rows_listed_first']({
                                                    count: result.skipped.length
                                                })}
                                            </p>
                                        {/if}
                                        <div class="rounded p-2">
                                            <div class="text-xs text-warning mb-2">
                                                <strong>{m['admin.row_numbers']()}</strong>
                                                {result.skipped.map((s) => s.row).join(', ')}
                                            </div>
                                            <div class="max-h-40 overflow-y-auto space-y-1">
                                                {#each expandedErrors.has(`skipped-${result.file}`) ? result.skipped : result.skipped.slice(0, 5) as skipped (skipped.row)}
                                                    <div
                                                        class="text-xs bg-warning/10 p-1.5 rounded break-words"
                                                    >
                                                        <strong class="text-warning"
                                                            >{m['admin.row_number']({
                                                                row: skipped.row
                                                            })}</strong
                                                        >
                                                        <span class="text-foreground"
                                                            >{skipReasonText(skipped.reason)}</span
                                                        >
                                                    </div>
                                                {/each}
                                                {#if !expandedErrors.has(`skipped-${result.file}`) && result.skipped.length > 5}
                                                    <div
                                                        class="text-xs text-muted-foreground text-center py-1"
                                                    >
                                                        {m['admin.more_duplicates_click_show_all']({
                                                            count: result.skipped.length - 5
                                                        })}
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <!-- After a dry run, nothing was imported yet. -->
        {#if csvImportResults && !csvImportResults.dryRun && csvImportResults.summary.totalImported > 0}
            <div class="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div class="flex items-start gap-2">
                    <FileArchive class="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div class="text-sm">
                        <p class="font-medium text-warning mb-1">
                            {m['admin.next_step_import_images']()}
                        </p>
                        <p class="text-foreground">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                            {@html m['admin.csv_data_with_imagename_fields']()}
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <div class="flex justify-end pt-4 border-t flex-shrink-0">
            <Button onclick={closeDialog}>{m['common.close']()}</Button>
        </div>
    </DialogContent>
</Dialog>
