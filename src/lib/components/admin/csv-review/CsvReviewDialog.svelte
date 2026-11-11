<script lang="ts">
    import { Download, FileArchive, LoaderCircle } from '@lucide/svelte';
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { CSV_TABLE_TEXTS } from '#lib/components/admin/csv-tables.js';
    import { m } from '#lib/paraglide/messages.js';
    import { CSV_OTHERS_KEY, csvRowKey } from '#lib/shared/csv-import.js';
    import type { CsvImportDTO } from '#lib/shared/dto.js';
    import { saveBlob } from '#lib/utils/download.js';
    import { skipReasonText } from '#lib/utils/import-problems.js';
    import CsvIssueCard from './CsvIssueCard.svelte';
    import { CsvReview, type CsvImportRequest } from './csv-review.svelte.js';
    import { ignoredRowsCsv, ignoredRowsFileName } from './ignored-rows.js';
    import { issueTitle } from './texts.js';

    let {
        open = $bindable(false),
        request,
        onImported
    }: {
        open: boolean;
        /** The files to review, from the dialog that chose them. */
        request: CsvImportRequest | null;
        /** Once the import is written. */
        onImported: () => Promise<void>;
    } = $props();

    let review = $state<CsvReview | null>(null);
    type Part = 'settle' | 'ready' | 'cellar' | 'ignored';
    let part = $state<Part>('settle');
    const uid = $props.id();

    $effect(() => {
        if (!open || !request) return;
        const started = new CsvReview(request);
        review = started;
        part = 'settle';
        started.check().then(() => {
            // A file with nothing to settle opens on what is ready, unless answers of earlier
            // imports were pre-filled: they are shown before they can be imported.
            if (!started.report?.review?.open && started.suggested.size === 0) part = 'ready';
        });
        return () => started.dispose();
    });

    const report = $derived(review?.report);
    const reviewed = $derived(report?.review);
    const results = $derived(report?.results ?? []);
    const openIssues = $derived(reviewed?.issues.filter((issue) => issue.open) ?? []);
    const summary = $derived(report?.summary);
    const titleOf = (result: CsvImportDTO['results'][number]) =>
        result.table ? `${CSV_TABLE_TEXTS[result.table].label()} (${result.file})` : result.file;

    // Once imported, the rows ready are imported, and none is left to settle.
    const parts = $derived<{ id: Part; label: string; count: number }[]>([
        {
            id: 'ready',
            label: review?.imported ? m['common.imported']() : m['admin.csv_review_ready'](),
            count: summary?.totalImported ?? 0
        },
        {
            id: 'cellar',
            label: m['admin.csv_review_in_cellar'](),
            count: summary?.totalSkipped ?? 0
        },
        ...(review?.imported
            ? []
            : [
                  {
                      id: 'settle' as const,
                      label: m['admin.csv_review_to_settle'](),
                      count: summary?.totalFailed ?? 0
                  }
              ]),
        { id: 'ignored', label: m['admin.csv_review_ignored'](), count: summary?.totalIgnored ?? 0 }
    ]);

    async function importFiles() {
        if (!review) return;
        if (await review.import()) {
            // The rows ignored are where they can be downloaded.
            part = review.report?.summary.totalIgnored ? 'ignored' : 'ready';
            await onImported();
        } else {
            part = 'settle';
        }
    }

    function download(result: CsvImportDTO['results'][number]) {
        const csv = ignoredRowsCsv(result, reviewed, request?.delimiter ?? ',');
        saveBlob(new Blob([csv], { type: 'text/csv' }), ignoredRowsFileName(result.file));
    }

    function close() {
        open = false;
        review?.dispose();
        review = null;
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && close()}>
    <ScrollingDialogContent
        title={review?.imported
            ? m['admin.csv_review_done_title']()
            : m['admin.csv_review_title']()}
        description={review?.imported ? undefined : m['admin.csv_review_description']()}
        error={review?.error ?? undefined}
        class="sm:max-w-4xl"
    >
        {#snippet toolbar()}
            <div
                class="grid grid-cols-2 gap-2 {review?.imported
                    ? 'sm:grid-cols-3'
                    : 'sm:grid-cols-4'}"
                role="tablist"
            >
                {#each parts as tab (tab.id)}
                    {@const selected = part === tab.id}
                    <button
                        type="button"
                        role="tab"
                        id="{uid}-tab-{tab.id}"
                        aria-selected={selected}
                        aria-controls="{uid}-part"
                        onclick={() => (part = tab.id)}
                        class="rounded-lg border p-1 text-center transition-colors sm:p-2 {selected
                            ? 'border-primary bg-primary/10'
                            : 'hover:bg-accent hover:text-accent-foreground'}"
                    >
                        <span class="block text-lg font-bold sm:text-xl">{tab.count}</span>
                        <span class="block text-xs text-muted-foreground">{tab.label}</span>
                    </button>
                {/each}
            </div>
        {/snippet}

        <div
            id="{uid}-part"
            role="tabpanel"
            aria-labelledby="{uid}-tab-{part}"
            aria-busy={review?.checking}
            class="space-y-3 py-2"
        >
            {#if !report}
                <p class="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle class="h-4 w-4 animate-spin" />
                    {m['admin.csv_review_checking']()}
                </p>
            {:else if part === 'settle'}
                {#if openIssues.length > 0}
                    <Button
                        size="sm"
                        variant="outline"
                        onclick={() => review?.answer(CSV_OTHERS_KEY, { action: 'ignore' })}
                    >
                        {m['admin.csv_review_ignore_others']()}
                    </Button>
                {/if}
                {#each reviewed?.issues ?? [] as issue (issue.key)}
                    <CsvIssueCard
                        {issue}
                        review={reviewed!}
                        answer={review!.answers[issue.key] ?? issue.answer}
                        suggested={review!.suggested.has(issue.key)}
                        onAnswer={(answer) => review!.answer(issue.key, answer)}
                    />
                {:else}
                    <p class="text-sm text-muted-foreground">{m['admin.csv_review_no_row']()}</p>
                {/each}
                {#if reviewed && reviewed.unlisted > 0}
                    <p class="text-sm text-muted-foreground">
                        {m['admin.csv_review_unlisted']({ count: reviewed.unlisted })}
                    </p>
                {/if}
            {:else if part === 'ready'}
                <ul class="space-y-1 text-sm">
                    {#each results as result (result.file)}
                        <li>
                            {m['admin.csv_review_file_rows']({
                                file: titleOf(result),
                                count: result.successfulImports
                            })}
                        </li>
                    {/each}
                </ul>
            {:else if part === 'cellar'}
                {#each results.filter((result) => result.skipped.length > 0) as result (result.file)}
                    <section class="space-y-1">
                        <h3 class="text-sm font-medium">{titleOf(result)}</h3>
                        <ul class="space-y-1 text-sm">
                            {#each result.skipped as skipped (skipped.row)}
                                {@const key = csvRowKey(result.file, skipped.row)}
                                <li class="flex flex-wrap items-center justify-between gap-2">
                                    <span class="min-w-0 [overflow-wrap:anywhere]">
                                        {m['admin.row_number']({ row: skipped.row })}
                                        {skipReasonText(skipped.reason)}
                                    </span>
                                    {#if result.table === 'wineBottles' && !review?.imported}
                                        <label class="flex items-center gap-2 text-xs">
                                            <input
                                                type="checkbox"
                                                checked={review?.answers[key]?.action === 'import'}
                                                onchange={(event) =>
                                                    review?.answer(
                                                        key,
                                                        event.currentTarget.checked
                                                            ? { action: 'import' }
                                                            : undefined
                                                    )}
                                            />
                                            {m['admin.csv_review_import_anyway']()}
                                        </label>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </section>
                {:else}
                    <p class="text-sm text-muted-foreground">{m['admin.csv_review_no_row']()}</p>
                {/each}
            {:else}
                {#each results.filter((result) => result.ignored.length > 0) as result (result.file)}
                    <section class="space-y-1">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="text-sm font-medium">{titleOf(result)}</h3>
                            {#if review?.imported}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onclick={() => download(result)}
                                >
                                    <Download class="mr-2 h-4 w-4" />
                                    {m['admin.csv_review_download_ignored']()}
                                </Button>
                            {/if}
                        </div>
                        <ul class="space-y-1 text-sm">
                            {#each result.ignored as ignored (ignored.row)}
                                {@const issue = reviewed?.issues.find(
                                    ({ key }) => key === ignored.key
                                )}
                                <li class="[overflow-wrap:anywhere]">
                                    {m['admin.row_number']({ row: ignored.row })}
                                    {issue ? issueTitle(issue) : ''}
                                </li>
                            {/each}
                        </ul>
                    </section>
                {:else}
                    <p class="text-sm text-muted-foreground">{m['admin.csv_review_no_row']()}</p>
                {/each}
            {/if}
        </div>

        {#snippet footer()}
            {#if review?.imported}
                {#if summary && summary.totalImported > 0}
                    <div class="w-full rounded-lg border border-warning/30 bg-warning/10 p-3">
                        <div class="flex items-start gap-2">
                            <FileArchive class="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                            <div class="text-sm">
                                <p class="mb-1 font-medium text-warning">
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
                <Button onclick={close}>{m['common.close']()}</Button>
            {:else}
                <p class="basis-full text-end text-xs text-muted-foreground" aria-live="polite">
                    {#if review?.checking}
                        {m['admin.csv_review_checking']()}
                    {:else if openIssues.length > 0}
                        {m['admin.csv_review_open_count']({ count: openIssues.length })}
                    {:else if report}
                        {m['admin.csv_review_all_settled']()}
                    {/if}
                </p>
                <Button variant="outline" onclick={close}>{m['common.cancel']()}</Button>
                <Button
                    onclick={importFiles}
                    disabled={!report ||
                        review?.checking ||
                        review?.importing ||
                        openIssues.length > 0}
                >
                    {m['admin.csv_review_import']()}
                </Button>
            {/if}
        {/snippet}
    </ScrollingDialogContent>
</Dialog>
