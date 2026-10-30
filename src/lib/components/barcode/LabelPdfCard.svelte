<script lang="ts">
    import { Printer } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { formatBarcode } from '#lib/shared/barcode.js';
    import type { LabelPreset } from '#lib/shared/dto.js';
    import type { LabelIssue } from '#lib/shared/labels.js';
    import BarcodeRange from './BarcodeRange.svelte';
    import LabelSettingsForm from './LabelSettingsForm.svelte';
    import PresetManager from './PresetManager.svelte';
    import { downloadFile, sendJson } from './api.js';
    import { labelIssueMessage } from './label-issue-message.js';
    import type { LabelOptions } from './label-options.svelte.js';

    /**
     * The PDF of a sheet of labels for a range of codes of the prefix of `options`. The server
     * reads the prefix only when automatic barcodes are off, and uses its own otherwise.
     * `prefixError` says what is wrong with the prefix, which then prints nothing. `options`
     * belongs to the page, so that it outlives the card.
     */
    let {
        presets,
        options,
        prefixError
    }: { presets: LabelPreset[]; options: LabelOptions; prefixError?: string } = $props();
    let generating = $state(false);
    // The message of the prefix, which the button names for assistive technologies
    const prefixErrorId = $props.id();

    // Apart, so that only the errors read as what prevents printing and saving.
    const errors = $derived(options.issues.filter((issue) => issue.blocking));
    const warnings = $derived(options.issues.filter((issue) => !issue.blocking));

    async function generatePdf() {
        generating = true;
        // Read now: the fields may change while the file comes.
        const request = options.request();
        await downloadFile(
            () => sendJson('POST', '/api/barcode/pdf-labels', request),
            'barcode-labels.pdf',
            {
                saved: () =>
                    m['toast.downloaded_labels']({
                        count: request.count,
                        barcode: formatBarcode(request.prefix, request.startNumber)
                    }),
                refused: (error) => m['toast.failed_to_generate_pdf']({ error }),
                failed: m['toast.error_generating_pdf']()
            }
        );
        generating = false;
    }
</script>

{#snippet issueList(issues: LabelIssue[], blocking: boolean)}
    <div
        class={[
            'p-3 rounded-lg border-2 border-dashed',
            blocking ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10'
        ]}
    >
        <div class="flex items-start gap-2">
            <div
                class={[
                    'flex-shrink-0 w-4 h-4 rounded-full mt-0.5',
                    blocking ? 'bg-destructive' : 'bg-warning'
                ]}
            ></div>
            <div class="flex-1 min-w-0">
                <p
                    class={[
                        'text-xs font-medium mb-1',
                        blocking ? 'text-destructive' : 'text-warning'
                    ]}
                >
                    {blocking
                        ? m['barcode.configuration_errors']()
                        : m['barcode.configuration_warnings']()}
                </p>
                <ul class={['text-xs space-y-1', blocking ? 'text-destructive' : 'text-warning']}>
                    {#each issues as issue (issue.code)}
                        <li>• {labelIssueMessage(issue)}</li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
{/snippet}

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <Printer class="h-5 w-5" />
            {m['barcode.generate_pdf_labels']()}
        </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <PresetManager {presets} {options} />
        <LabelSettingsForm {options} />

        {#if errors.length > 0}
            {@render issueList(errors, true)}
        {/if}
        {#if warnings.length > 0}
            {@render issueList(warnings, false)}
        {/if}

        <div class="pt-2 border-t">
            {#if prefixError}
                <p id={prefixErrorId} class="text-sm text-destructive mb-2">{prefixError}</p>
            {/if}
            <Button
                onclick={generatePdf}
                disabled={generating || !options.printable || !!prefixError}
                aria-describedby={prefixError ? prefixErrorId : undefined}
                class="w-full"
            >
                {#if generating}
                    {m['barcode.generating']()}
                {:else}
                    <Printer class="h-4 w-4 mr-2" />
                    {m['barcode.generate_pdf']()}
                {/if}
            </Button>
            {#if !prefixError}
                <p class="text-xs text-muted-foreground mt-2 text-center">
                    {m['barcode.preview']()}
                    <BarcodeRange
                        prefix={options.prefix}
                        start={options.startNumber}
                        count={options.count}
                    />
                </p>
            {/if}
        </div>
    </CardContent>
</Card>
