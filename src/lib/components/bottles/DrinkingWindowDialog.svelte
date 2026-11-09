<script lang="ts">
    import type { Snippet } from 'svelte';
    import { CalendarCog, CalendarDays, CalendarRange, ChevronDown } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import type { DrinkingDates } from '#lib/shared/drinking.js';
    import { cn } from '#lib/utils.js';
    import { BottleChanges } from './bottle-changes.svelte.js';
    import ConfirmButtons from './ConfirmButtons.svelte';
    import DrinkingWindowFields from './DrinkingWindowFields.svelte';
    import { drinkBeforeText, quickDates, windowText } from './drinking.js';

    /**
     * Gives bottles a drinking window: an end this month or this year in one click, which removes
     * the start, or a start and an end chosen, or removes both. The screen mounts it to open it,
     * with the bottles to change, and unmounts it on `onClose`.
     */
    let {
        bottles,
        onClose,
        onSaved,
        onMissing,
        children
    }: {
        bottles: (DrinkingDates & { id: string })[];
        onClose: () => void;
        /** After the change, before the dialog closes: the screen reloads its bottles. */
        onSaved: () => Promise<void> | void;
        /** Bottles deleted elsewhere: the screen leaves them out of `bottles` and reloads. */
        onMissing: (ids: string[]) => Promise<void> | void;
        /** What the screen shows of the bottles above the choices. */
        children?: Snippet;
    } = $props();

    const { thisMonth, thisYear } = quickDates();
    const windowOf = ({ drinkFrom, drinkBefore }: DrinkingDates) => `${drinkFrom}/${drinkBefore}`;
    // The window of all the bottles, when they share one.
    const shared = $derived(new Set(bottles.map(windowOf)).size === 1 ? bottles[0] : undefined);
    const dated = $derived(
        bottles.some(({ drinkFrom, drinkBefore }) => drinkFrom !== null || drinkBefore !== null)
    );
    const current = $derived.by(() => {
        if (shared === undefined) return m['drinking.mixed_dates']();
        const text = windowText(shared);
        return text ? m['drinking.current']({ date: text }) : m['drinking.no_date']();
    });

    let choosing = $state(false);
    // svelte-ignore state_referenced_locally
    let chosenFrom = $state(shared?.drinkFrom ?? '');
    // svelte-ignore state_referenced_locally
    let chosenBefore = $state(shared?.drinkBefore ?? '');

    const changes = new BottleChanges({
        onSaved: async (count) => {
            toasts.add(m['toast.bottles_updated']({ count }), 'success');
            await onSaved();
            onClose();
        },
        onMissing: (ids) => onMissing(ids)
    });

    function save(drinkFrom: string | null, drinkBefore: string | null) {
        changes.send(
            bottles.map(({ id }) => id),
            { changes: { drinkFrom: drinkFrom || null, drinkBefore: drinkBefore || null } }
        );
    }

    const tile = 'h-auto flex-col gap-1 py-3 whitespace-normal';
    const id = $props.id();
</script>

{#snippet quick(label: string, value: string, Icon: typeof CalendarDays)}
    <Button
        variant="outline"
        class={tile}
        disabled={changes.sending}
        onclick={() => save(null, value)}
    >
        <Icon class="h-5 w-5" aria-hidden="true" />
        <span>{label}</span>
        <span class="text-xs font-normal text-muted-foreground">{drinkBeforeText(value)}</span>
    </Button>
{/snippet}

<!-- Not closed while a change is on its way: the guard against sending it twice goes with the dialog. -->
<Dialog bind:open={() => true, (open) => !open && !changes.sending && onClose()}>
    <DialogContent class="max-w-md" showCloseButton={!changes.sending}>
        <DialogHeader>
            <DialogTitle>{m['drinking.window']()}</DialogTitle>
            <DialogDescription>
                {m['common.n_bottles']({ count: bottles.length })} · {current}
            </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
            {@render children?.()}
            <div class="grid grid-cols-3 gap-2">
                {@render quick(m['drinking.this_month'](), thisMonth, CalendarDays)}
                {@render quick(m['drinking.this_year'](), thisYear, CalendarRange)}
                <Button
                    variant={choosing ? 'secondary' : 'outline'}
                    class={tile}
                    disabled={changes.sending}
                    aria-expanded={choosing}
                    aria-controls={choosing ? `${id}-choose` : undefined}
                    onclick={() => (choosing = !choosing)}
                >
                    <CalendarCog class="h-5 w-5" aria-hidden="true" />
                    <span>{m['drinking.choose']()}</span>
                    <ChevronDown
                        class={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform',
                            choosing && 'rotate-180'
                        )}
                        aria-hidden="true"
                    />
                </Button>
            </div>
            {#if choosing}
                <div id="{id}-choose" class="space-y-4 rounded-md border p-3">
                    <DrinkingWindowFields
                        bind:drinkFrom={chosenFrom}
                        bind:drinkBefore={chosenBefore}
                        disabled={changes.sending}
                    />
                    <ConfirmButtons
                        sending={changes.sending}
                        onCancel={() => (choosing = false)}
                        onConfirm={() => save(chosenFrom, chosenBefore)}
                    />
                </div>
            {/if}
            <p class="text-sm text-muted-foreground">{m['drinking.tiles_hint']()}</p>
            {#if dated || !choosing}
                <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    {#if dated}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={changes.sending}
                            onclick={() => save(null, null)}
                        >
                            {m['drinking.remove_dates']()}
                        </Button>
                    {/if}
                    {#if !choosing}
                        <Button
                            variant="outline"
                            size="sm"
                            class="ml-auto"
                            disabled={changes.sending}
                            onclick={onClose}
                        >
                            {m['common.cancel']()}
                        </Button>
                    {/if}
                </div>
            {/if}
        </div>
    </DialogContent>
</Dialog>
