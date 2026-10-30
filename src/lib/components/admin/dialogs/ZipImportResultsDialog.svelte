<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import ScrollRegion from '#lib/components/admin/ScrollRegion.svelte';
    import { FileArchive } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { ZipImportDTO } from '#lib/shared/dto.js';

    let {
        open = $bindable(false),
        zipImportResults = $bindable(null)
    }: {
        open: boolean;
        zipImportResults: ZipImportDTO | null;
    } = $props();

    // The server names the outcome of each file; any other reason is the message of an unexpected
    // error, which its log keeps.
    const REASONS: Record<string, () => string> = {
        image_imported_successfully: m['admin.image_imported_successfully'],
        filename_not_found_in_database: m['admin.filename_not_found_in_database'],
        invalid_filename: m['admin.image_invalid_filename'],
        not_an_image: m['admin.image_not_an_image'],
        duplicate_filename: m['admin.image_duplicate_filename']
    };

    function closeDialog() {
        open = false;
        zipImportResults = null;
    }
</script>

<Dialog bind:open>
    <DialogContent class="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <FileArchive class="h-5 w-5 text-primary" />
                {m['admin.zip_import_results']()}
            </DialogTitle>
        </DialogHeader>

        {#if zipImportResults}
            {@const detailsTitle = m['admin.detailed_results_files_processed']({
                count: zipImportResults.totalProcessed || zipImportResults.summary?.length || 0
            })}
            <div class="space-y-4">
                <!-- Summary -->
                <div class="grid grid-cols-3 gap-2 sm:gap-4">
                    <div class="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
                        <div class="text-2xl font-bold text-success">
                            {zipImportResults.successful}
                        </div>
                        <div class="text-sm text-success">{m['admin.zip_import_imported']()}</div>
                    </div>
                    <div class="bg-warning/10 border border-warning/30 rounded-lg p-3 text-center">
                        <div class="text-2xl font-bold text-warning">
                            {zipImportResults.skipped}
                        </div>
                        <div class="text-sm text-warning">{m['admin.zip_import_skipped']()}</div>
                    </div>
                    <div
                        class="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center"
                    >
                        <div class="text-2xl font-bold text-destructive">
                            {zipImportResults.errors}
                        </div>
                        <div class="text-sm text-destructive">{m['admin.zip_import_errors']()}</div>
                    </div>
                </div>

                <!-- Detailed Results -->
                <div class="border rounded-lg overflow-hidden">
                    <div class="bg-muted px-4 py-2 border-b">
                        <h4 class="font-semibold">{detailsTitle}</h4>
                    </div>

                    <ScrollRegion label={detailsTitle} class="max-h-96 rounded-none">
                        {#if zipImportResults.summary && zipImportResults.summary.length > 0}
                            <div class="divide-y">
                                <!-- By position: the report can list a name twice. -->
                                {#each zipImportResults.summary as item, i (i)}
                                    <div
                                        class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                                    >
                                        <div class="flex min-w-0 items-center gap-3">
                                            {#if item.status === 'success'}
                                                <div
                                                    class="w-2 h-2 shrink-0 bg-success rounded-full"
                                                ></div>
                                            {:else if item.status === 'skipped'}
                                                <div
                                                    class="w-2 h-2 shrink-0 bg-warning rounded-full"
                                                ></div>
                                            {:else}
                                                <div
                                                    class="w-2 h-2 shrink-0 bg-destructive rounded-full"
                                                ></div>
                                            {/if}
                                            <span class="font-mono text-sm break-all"
                                                >{item.filename}</span
                                            >
                                        </div>
                                        <div class="text-right">
                                            <div
                                                class="text-sm font-medium
                                                {item.status === 'success'
                                                    ? 'text-success'
                                                    : item.status === 'skipped'
                                                      ? 'text-warning'
                                                      : 'text-destructive'}"
                                            >
                                                {item.status === 'success'
                                                    ? m['admin.status_success']()
                                                    : item.status === 'skipped'
                                                      ? m['admin.status_skipped']()
                                                      : m['admin.status_error']()}
                                            </div>
                                            <div class="text-xs text-muted-foreground">
                                                {Object.hasOwn(REASONS, item.reason)
                                                    ? REASONS[item.reason]()
                                                    : m['admin.image_copy_failed']()}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="px-4 py-8 text-center text-muted-foreground">
                                {m['admin.no_detailed_results_available']()}
                            </div>
                        {/if}
                    </ScrollRegion>
                </div>

                <!-- Overall Status Message -->
                <div class="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                    {#if zipImportResults.successful > 0 && zipImportResults.skipped === 0 && zipImportResults.errors === 0}
                        <p class="text-success">
                            ✅ {m['admin.all_images_imported_successfully']()}
                        </p>
                    {:else if zipImportResults.successful === 0 && zipImportResults.skipped > 0}
                        <p class="text-warning">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                            ℹ️ {@html m['admin.all_images_skipped_no_match']({
                                imageName: '<code>imageName</code>'
                            })}
                        </p>
                    {:else if zipImportResults.successful === 0 && zipImportResults.errors > 0}
                        <p class="text-destructive">
                            ❌ {m['admin.import_failed_check_details']()}
                        </p>
                    {:else}
                        <p>{m['admin.import_completed_mixed_results']()}</p>
                    {/if}
                </div>
            </div>
        {/if}

        <div class="flex justify-end pt-4 border-t">
            <Button onclick={closeDialog}>
                {m['common.close']()}
            </Button>
        </div>
    </DialogContent>
</Dialog>
