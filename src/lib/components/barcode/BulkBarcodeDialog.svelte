<script lang="ts">
    import { Dialog } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Checkbox } from '#lib/components/ui/checkbox/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import { Textarea } from '#lib/components/ui/textarea/index.js';
    import QrScannerDialog from '#lib/components/barcode/QrScannerDialog.svelte';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import ScrollRegion from '#lib/components/layout/ScrollRegion.svelte';
    import { ArrowRightLeft, Camera, LogIn, LogOut, Wine } from '@lucide/svelte';
    import { findBarcodeMatches } from '#lib/shared/barcode.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import { today } from '#lib/utils/format.js';
    import AvailabilityBadge from '#lib/components/bottles/AvailabilityBadge.svelte';
    import { availabilityLabel } from '#lib/components/bottles/availability.js';
    import { bottleName } from '#lib/components/bottles/bottle-table.js';
    import {
        BottleChanges,
        newStatus,
        type BottlesUpdate
    } from '#lib/components/bottles/bottle-changes.svelte.js';
    import CaseTargetPicker from '#lib/components/bottles/CaseTargetPicker.svelte';
    import ConsumptionFields from '#lib/components/bottles/ConsumptionFields.svelte';
    import {
        computeRows,
        currentCaseId,
        locationChanges,
        type BarcodedBottle,
        type Line,
        type Row
    } from '#lib/components/barcode/bulk-barcode.js';

    let {
        open = $bindable(false),
        bottles,
        onBottlesChanged
    }: {
        open?: boolean;
        /** The bottles of the wine list that a code can find: those still owned (UI-14). */
        bottles: BarcodedBottle[];
        /** Called after a change to the bottles, for the parent to reload them. */
        onBottlesChanged: () => Promise<void> | void;
    } = $props();

    const uid = $props.id();
    // The summary of the check names the list of its rows.
    const summaryId = `${uid}-summary`;
    // Check is greyed without a code: the count under the field, at « No code », says why.
    const countId = `${uid}-count`;

    type BulkAction = 'consume' | 'take_out' | 'return' | 'move';

    const APPLY_LABELS: Record<BulkAction, (inputs: { count: number }) => string> = {
        consume: m['bulk.apply_consume'],
        take_out: m['bulk.apply_take_out'],
        return: m['bulk.apply_return'],
        move: m['bulk.apply_move']
    };

    // Each action boils down to a target status and/or a target location
    const ACTION_AVAILABILITY: Record<string, string> = {
        consume: BottleAvailability.CONSUMED,
        take_out: BottleAvailability.OUT_OF_CELLAR,
        return: BottleAvailability.AVAILABLE
    };

    // computeRows finds a row only with its bottle.
    type FoundRow = Row<BarcodedBottle> & { bottle: BarcodedBottle };

    let step = $state<'input' | 'review'>('input');
    let codesText = $state('');
    let showScanner = $state(false);
    let lines = $state<Line<BarcodedBottle>[]>([]);

    // Action state
    let action = $state<BulkAction | ''>('');
    let returnToNewLocation = $state(false);
    let consumedDate = $state('');
    let consumedNote = $state('');
    let selectedCaseId = $state('');

    // The bottles as last loaded: the rows read them, not the copies taken when checking codes.
    const bottlesById = $derived(new Map(bottles.map((bottle) => [bottle.id, bottle])));
    const codes = $derived(parseCodes(codesText));

    const actionOptions = $derived([
        {
            value: 'consume' as BulkAction,
            icon: Wine,
            label: m['bulk.action_consume'](),
            hint: m['bulk.action_consume_hint']()
        },
        {
            value: 'take_out' as BulkAction,
            icon: LogOut,
            label: m['bulk.action_take_out'](),
            hint: m['bulk.action_take_out_hint']()
        },
        {
            value: 'return' as BulkAction,
            icon: LogIn,
            label: m['bulk.action_return'](),
            hint: m['bulk.action_return_hint']()
        },
        {
            value: 'move' as BulkAction,
            icon: ArrowRightLeft,
            label: m['bulk.action_move'](),
            hint: m['bulk.action_move_hint']()
        }
    ]);

    const targetAvailability = $derived(action ? ACTION_AVAILABILITY[action] || '' : '');
    const asksLocation = $derived(
        action === 'move' || (action === 'return' && returnToNewLocation)
    );
    const targetCaseId = $derived(asksLocation ? selectedCaseId : '');
    const missingLocation = $derived(asksLocation && !selectedCaseId);

    const rows = $derived(computeRows(lines, bottlesById, targetAvailability, targetCaseId));
    const selectedRows = $derived(
        rows.filter(
            (row): row is FoundRow => row.state === 'found' && row.included && row.willChange
        )
    );
    const foundCount = $derived(rows.filter((row) => row.state === 'found').length);
    const issueCount = $derived(
        rows.filter((row) => row.state === 'ambiguous' || row.state === 'not_found').length
    );
    const incomingCount = $derived(
        selectedRows.filter((row) => locationChanges(row.bottle, targetAvailability, targetCaseId))
            .length
    );
    const withoutLocationCount = $derived(
        targetAvailability === BottleAvailability.AVAILABLE
            ? selectedRows.filter((row) => !currentCaseId(row.bottle) && !targetCaseId).length
            : 0
    );

    function parseCodes(text: string): string[] {
        // One code per line, but also accept codes pasted from a spreadsheet row
        return text
            .split(/[\s,;]+/)
            .map((code) => code.trim())
            .filter(Boolean);
    }

    function checkCodes() {
        lines = codes.map((code) => {
            const matches = findBarcodeMatches(bottles, code);
            return {
                code,
                matches,
                chosenId: matches.length === 1 ? matches[0].id : '',
                included: true
            };
        });
        step = 'review';
    }

    function backToInput() {
        step = 'input';
    }

    function toggleLine(index: number) {
        lines[index].included = !lines[index].included;
    }

    const matchLabel = (match: BarcodedBottle) =>
        `${match.barcode} · ${bottleName(match)} · ${availabilityLabel(match.availability)}`;

    function chooseBottle(index: number, bottleId: string) {
        lines[index].chosenId = bottleId;
        lines[index].included = true;
    }

    function handleScan(value: string) {
        const code = value.trim();
        if (!code) return;
        const separator = codesText && !codesText.endsWith('\n') ? '\n' : '';
        codesText = `${codesText}${separator}${code}\n`;
    }

    function selectAction(value: BulkAction) {
        action = value;
        returnToNewLocation = false;
        selectedCaseId = '';
        if (value === 'consume' && !consumedDate) {
            consumedDate = today();
        }
    }

    function setReturnToNewLocation(value: boolean) {
        returnToNewLocation = value;
        if (!value) {
            selectedCaseId = '';
        }
    }

    /**
     * The same update for every selected bottle: each one changes status, place or both, and
     * setting the status or place it already has changes nothing.
     */
    function buildUpdate(): BottlesUpdate {
        const update: BottlesUpdate = targetAvailability
            ? newStatus(targetAvailability as BottleAvailability, consumedDate, consumedNote)
            : { changes: {} };
        if (!targetCaseId) return update;
        return { ...update, changes: { ...update.changes, storageCaseId: targetCaseId } };
    }

    const changes = new BottleChanges({
        onSaved: async (count) => {
            toasts.add(m['toast.bottles_updated']({ count }), 'success');
            await onBottlesChanged();
            reset();
            open = false;
        },
        // The other lines stay, to be applied again.
        onMissing: async (ids) => {
            lines = lines.filter((line) => !ids.includes(line.chosenId));
            await onBottlesChanged();
        }
    });

    function applyChanges() {
        if (!auth.isAuthenticated) {
            toasts.add(m['bottles.log_in_to_change_availability'](), 'warning');
            return;
        }
        changes.send(
            selectedRows.map((row) => row.bottle.id),
            buildUpdate()
        );
    }

    function reset() {
        step = 'input';
        codesText = '';
        lines = [];
        action = '';
        returnToNewLocation = false;
        consumedDate = '';
        consumedNote = '';
        selectedCaseId = '';
    }

    // Closing keeps the typed codes so an accidental close does not lose a long list. It waits
    // for a change on its way: opening again could send it twice.
    function setOpen(isOpen: boolean) {
        if (!isOpen && changes.sending) return;
        open = isOpen;
        if (!isOpen) {
            step = 'input';
            showScanner = false;
        }
    }
</script>

<Dialog bind:open={() => open, setOpen}>
    <ScrollingDialogContent
        title={m['bulk.title']()}
        description={m['bulk.description']()}
        class="max-w-3xl sm:max-w-3xl"
    >
        {#if step === 'input'}
            <div class="space-y-2">
                <Label for="bulk-codes">{m['bulk.codes_label']()}</Label>
                <Textarea
                    id="bulk-codes"
                    bind:value={codesText}
                    placeholder={m['bulk.codes_placeholder']()}
                    class="w-full min-h-[220px] font-mono"
                />
                <div class="flex justify-between gap-2 text-sm text-muted-foreground">
                    <span>{m['bulk.codes_hint']()}</span>
                    <span id={countId} class="whitespace-nowrap"
                        >{m['bulk.codes_count']({ count: codes.length })}</span
                    >
                </div>
            </div>
        {:else}
            <div class="space-y-4">
                <!-- Focused when the check ends, where the Check button was: the step starts at
                     its top, and a screen reader hears its result. -->
                <p
                    id={summaryId}
                    class="text-sm text-muted-foreground focus:outline-none"
                    tabindex="-1"
                    {@attach (summary) => summary.focus()}
                >
                    {m['bulk.summary']({ found: foundCount, issues: issueCount })}
                </p>

                <!-- Its own scroll on a desktop, so that a long list leaves the action in view; a
                     phone keeps a single scroll, the dialog's. -->
                <ScrollRegion
                    labelledby={summaryId}
                    class="sm:max-h-60 p-0 rounded-md border divide-y"
                >
                    {#each rows as row (row.index)}
                        <div
                            class="flex items-start gap-3 px-3 py-2 text-sm {row.state ===
                                'found' && row.included
                                ? ''
                                : 'bg-muted/40'}"
                        >
                            <div class="w-4 pt-0.5 shrink-0">
                                {#if row.state === 'found'}
                                    <Checkbox
                                        checked={row.included}
                                        onCheckedChange={() => toggleLine(row.index)}
                                        disabled={changes.sending}
                                    />
                                {/if}
                            </div>
                            <span class="font-mono w-28 shrink-0 break-all">{row.code}</span>
                            <div class="flex-1 min-w-0 space-y-1">
                                {#if row.state === 'not_found'}
                                    <span class="text-destructive font-medium"
                                        >{m['bulk.not_found']()}</span
                                    >
                                {/if}

                                {#if row.matches.length > 1}
                                    <!-- Named with the code of its row, the one thing that tells the rows apart. -->
                                    <OptionSelect
                                        value={row.chosenId}
                                        aria-label={m['bulk.choose_bottle_for']({ code: row.code })}
                                        size="sm"
                                        placeholder="{m['bulk.ambiguous']({
                                            count: row.matches.length
                                        })} — {m['bulk.choose_bottle']()}"
                                        options={row.matches.map((match) => ({
                                            value: match.id,
                                            label: matchLabel(match)
                                        }))}
                                        onValueChange={(id) => chooseBottle(row.index, id)}
                                        disabled={changes.sending}
                                    />
                                {/if}

                                {#if row.bottle}
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span class="font-medium">{bottleName(row.bottle)}</span>
                                        <span class="text-muted-foreground"
                                            >{row.bottle.definition?.producer || ''}</span
                                        >
                                        {#if row.bottle.barcode !== row.code}
                                            <span class="font-mono text-muted-foreground"
                                                >{row.bottle.barcode}</span
                                            >
                                        {/if}
                                        <span class="text-muted-foreground"
                                            >· {row.bottle.storageCase?.name ||
                                                m['bulk.no_location']()}</span
                                        >
                                        <AvailabilityBadge availability={row.bottle.availability} />
                                    </div>
                                {/if}

                                {#if row.state === 'duplicate'}
                                    <span class="text-muted-foreground italic"
                                        >{m['bulk.duplicate']()}</span
                                    >
                                {:else if row.state === 'found' && action}
                                    {#if row.locationIgnored}
                                        <span class="text-muted-foreground italic"
                                            >{m['bulk.consumed_cannot_move']()}</span
                                        >
                                    {:else if !row.willChange}
                                        <span class="text-muted-foreground italic"
                                            >{m['bulk.no_change']()}</span
                                        >
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    {/each}
                </ScrollRegion>

                <div class="space-y-4 rounded-md border p-3">
                    <div class="space-y-2">
                        <Label>{m['bulk.action_label']()}</Label>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {#each actionOptions as option (option.value)}
                                {@const Icon = option.icon}
                                <button
                                    type="button"
                                    class="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors disabled:opacity-50 {action ===
                                    option.value
                                        ? 'border-primary bg-primary/10'
                                        : 'hover:bg-accent'}"
                                    onclick={() => selectAction(option.value)}
                                    aria-pressed={action === option.value}
                                    disabled={changes.sending}
                                >
                                    <Icon
                                        class="h-4 w-4 {action === option.value
                                            ? 'text-primary'
                                            : 'text-muted-foreground'}"
                                    />
                                    <span class="text-sm font-medium">{option.label}</span>
                                    <span class="text-xs text-muted-foreground">{option.hint}</span>
                                </button>
                            {/each}
                        </div>
                    </div>

                    {#if action === 'consume'}
                        <ConsumptionFields
                            bind:date={consumedDate}
                            bind:note={consumedNote}
                            disabled={changes.sending}
                            class="grid gap-3 sm:grid-cols-2"
                        />
                    {:else if action === 'take_out'}
                        <p class="text-xs text-muted-foreground">{m['bulk.take_out_info']()}</p>
                    {:else if action === 'return'}
                        <div class="space-y-2">
                            <Label>{m['common.location']()}</Label>
                            <div class="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant={returnToNewLocation ? 'outline' : 'default'}
                                    onclick={() => setReturnToNewLocation(false)}
                                    disabled={changes.sending}
                                >
                                    {m['bulk.keep_location']()}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={returnToNewLocation ? 'default' : 'outline'}
                                    onclick={() => setReturnToNewLocation(true)}
                                    disabled={changes.sending}
                                >
                                    {m['bulk.store_elsewhere']()}
                                </Button>
                            </div>
                        </div>
                    {/if}

                    {#if asksLocation}
                        <CaseTargetPicker
                            bind:caseId={selectedCaseId}
                            incoming={incomingCount}
                            label={action === 'move' ? m['bulk.move_location_label']() : undefined}
                            disabled={changes.sending}
                        />
                    {/if}

                    {#if withoutLocationCount > 0}
                        <p class="text-xs text-warning">
                            {m['bulk.without_location_warning']({ count: withoutLocationCount })}
                        </p>
                    {/if}
                </div>
            </div>
        {/if}

        {#snippet footer()}
            <div class="flex flex-1 flex-wrap justify-between gap-2">
                {#if step === 'input'}
                    <Button variant="outline" onclick={() => (showScanner = true)}>
                        <Camera class="h-4 w-4 mr-2" />
                        {m['bulk.scan']()}
                    </Button>
                    <Button
                        onclick={checkCodes}
                        disabled={codes.length === 0}
                        aria-describedby={codes.length === 0 ? countId : undefined}
                    >
                        {m['bulk.check']()}
                    </Button>
                {:else}
                    <Button variant="outline" onclick={backToInput} disabled={changes.sending}>
                        {m['bulk.edit_list']()}
                    </Button>
                    <Button
                        onclick={applyChanges}
                        disabled={changes.sending ||
                            !action ||
                            missingLocation ||
                            selectedRows.length === 0}
                    >
                        {#if changes.sending}
                            {m['common.updating']()}
                        {:else if !action}
                            {m['bulk.choose_action']()}
                        {:else if missingLocation}
                            {m['bulk.choose_location']()}
                        {:else}
                            {APPLY_LABELS[action]({ count: selectedRows.length })}
                        {/if}
                    </Button>
                {/if}
            </div>
        {/snippet}
    </ScrollingDialogContent>
</Dialog>

<QrScannerDialog bind:open={showScanner} continuous={true} onScan={handleScan} />
