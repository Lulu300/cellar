<script lang="ts">
    import { onDestroy } from 'svelte';
    import { Camera, ListChecks } from '@lucide/svelte';
    import BulkBarcodeDialog from '#lib/components/barcode/BulkBarcodeDialog.svelte';
    import QrScannerDialog from '#lib/components/barcode/QrScannerDialog.svelte';
    import {
        barcodedBottles,
        searchBarcode,
        type BarcodedBottle
    } from '#lib/components/barcode/bulk-barcode.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { WineGroupDTO } from '#lib/shared/dto.js';
    import { toasts } from '#lib/stores/toast.svelte.js';

    /**
     * Finds a bottle of the list by its barcode, typed or scanned, and opens the bulk entry of
     * codes. The list holds only the bottles still owned, which the bottle dialog shows.
     */
    let {
        wines,
        code = $bindable(),
        onFound,
        onBottlesChanged
    }: {
        wines: WineGroupDTO[];
        /** The code in the field, which the parent clears when the dialog of a bottle closes. */
        code: string;
        /** Called with the one bottle that a search found, or the one chosen among several. */
        onFound: (bottle: BarcodedBottle) => void;
        /** Called after the bulk entry changed bottles, for the parent to reload them. */
        onBottlesChanged: () => Promise<void> | void;
    } = $props();

    let error = $state('');
    let errorTimeout: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(errorTimeout));
    let results = $state.raw<BarcodedBottle[]>([]);
    let showScanner = $state(false);
    let showBulkDialog = $state(false);

    const bottles = $derived(barcodedBottles(wines));

    function clearResults() {
        error = '';
        results = [];
        clearTimeout(errorTimeout);
    }

    function search() {
        clearResults();
        const term = code.trim();
        if (!term) return;

        const found = searchBarcode(bottles, term);
        if (found.length === 1) {
            onFound(found[0]);
        } else if (found.length > 1) {
            results = found;
        } else {
            error = m['wines.no_bottle_found']();
            toasts.add(m['wines.no_bottle_found_with_barcode']({ barcode: term }), 'warning', 4000);
            errorTimeout = setTimeout(() => (error = ''), 5000);
        }
    }

    function choose(bottle: BarcodedBottle) {
        code = bottle.barcode;
        results = [];
        onFound(bottle);
    }

    function scanned(value: string) {
        code = value;
        search();
    }
</script>

<div class="mt-4">
    <div class="space-y-2">
        <Label for="barcode">{m['wines.barcode_search']()}</Label>
        <form
            onsubmit={(e) => {
                e.preventDefault();
                search();
            }}
            class="flex gap-2 items-center"
        >
            <Input
                id="barcode"
                bind:value={code}
                aria-describedby="barcode-hint"
                class="flex-1 max-w-xs"
                oninput={clearResults}
            />
            <Button type="submit" variant="outline" size="sm">
                {m['wines.search']()}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => (showScanner = true)}
                title={m['scanner.title']()}
                aria-label={m['scanner.title']()}
            >
                <Camera class="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => (showBulkDialog = true)}
                title={m['bulk.title']()}
                aria-label={m['bulk.title']()}
            >
                <ListChecks class="h-4 w-4" aria-hidden="true" />
            </Button>
            {#if error}
                <span class="text-sm text-destructive font-medium ml-3">
                    {error}
                </span>
            {/if}
        </form>
        <!-- Under the field rather than inside it, where it did not fit on a phone -->
        <p id="barcode-hint" class="text-xs text-muted-foreground">
            {m['wines.barcode_search_hint']()}
        </p>

        {#if results.length > 0}
            <div class="mt-2 p-3 bg-muted/50 rounded-lg border max-w-lg">
                <p class="text-sm text-muted-foreground mb-2">
                    {m['wines.multiple_results_found']({ count: results.length })}
                </p>
                <div class="space-y-1 max-h-48 overflow-y-auto">
                    {#each results as bottle (bottle.id)}
                        <button
                            type="button"
                            class="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors text-sm flex justify-between items-center gap-2"
                            onclick={() => choose(bottle)}
                        >
                            <span class="font-mono text-primary-text">{bottle.barcode}</span>
                            <span class="text-muted-foreground truncate">
                                {bottle.definition.name || m['common.not_available']()}
                                {#if bottle.vintage}
                                    ({bottle.vintage})
                                {/if}
                            </span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>

<BulkBarcodeDialog bind:open={showBulkDialog} {bottles} {onBottlesChanged} />

<QrScannerDialog bind:open={showScanner} onScan={scanned} />
