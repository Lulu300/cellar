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
    import { cn } from '#lib/utils.js';
    import { BottleChanges } from './bottle-changes.svelte.js';
    import ConfirmButtons from './ConfirmButtons.svelte';
    import DrinkBeforeFields from './DrinkBeforeFields.svelte';
    import { drinkBeforeText, quickDates } from './drinking.js';

    /**
     * Gives bottles a « drink before »: this month or this year in one click, or a year and a
     * month chosen, or removes it. The screen mounts it to open it, with the bottles to change, and
     * unmounts it on `onClose`.
     */
    let {
        bottles,
        onClose,
        onSaved,
        onMissing,
        children
    }: {
        bottles: { id: string; drinkBefore: string | null }[];
        onClose: () => void;
        /** After the change, before the dialog closes: the screen reloads its bottles. */
        onSaved: () => Promise<void> | void;
        /** Bottles deleted elsewhere: the screen leaves them out of `bottles` and reloads. */
        onMissing: (ids: string[]) => Promise<void> | void;
        /** What the screen shows of the bottles above the choices. */
        children?: Snippet;
    } = $props();

    const { thisMonth, thisYear } = quickDates();
    const dates = $derived(new Set(bottles.map(({ drinkBefore }) => drinkBefore)));
    const shared = $derived(dates.size === 1 ? [...dates][0] : undefined);
    const dated = $derived(bottles.some(({ drinkBefore }) => drinkBefore !== null));
    const current = $derived.by(() => {
        if (shared === undefined) return m['drinking.mixed_dates']();
        return shared === null
            ? m['drinking.no_date']()
            : m['drinking.current']({ date: drinkBeforeText(shared) });
    });

    let choosing = $state(false);
    // svelte-ignore state_referenced_locally
    let chosen = $state(shared ?? '');

    const changes = new BottleChanges({
        onSaved: async (count) => {
            toasts.add(m['toast.bottles_updated']({ count }), 'success');
            await onSaved();
            onClose();
        },
        onMissing: (ids) => onMissing(ids)
    });

    function save(drinkBefore: string | null) {
        changes.send(
            bottles.map(({ id }) => id),
            { changes: { drinkBefore } }
        );
    }

    const tile = 'h-auto flex-col gap-1 py-3 whitespace-normal';
    const id = $props.id();
</script>

{#snippet quick(label: string, value: string, Icon: typeof CalendarDays)}
    <Button variant="outline" class={tile} disabled={changes.sending} onclick={() => save(value)}>
        <Icon class="h-5 w-5" aria-hidden="true" />
        <span>{label}</span>
        <span class="text-xs font-normal text-muted-foreground">{drinkBeforeText(value)}</span>
    </Button>
{/snippet}

<!-- Not closed while a change is on its way: the guard against sending it twice goes with the dialog. -->
<Dialog bind:open={() => true, (open) => !open && !changes.sending && onClose()}>
    <DialogContent class="max-w-md" showCloseButton={!changes.sending}>
        <DialogHeader>
            <DialogTitle>{m['drinking.drink_before']()}</DialogTitle>
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
                    aria-controls="{id}-choose"
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
                    <DrinkBeforeFields bind:value={chosen} disabled={changes.sending} />
                    <ConfirmButtons
                        sending={changes.sending}
                        onCancel={() => (choosing = false)}
                        onConfirm={() => save(chosen)}
                    />
                </div>
            {/if}
            {#if dated || !choosing}
                <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    {#if dated}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={changes.sending}
                            onclick={() => save(null)}
                        >
                            {m['drinking.remove_date']()}
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
