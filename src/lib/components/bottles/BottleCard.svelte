<script lang="ts">
    import {
        Calendar,
        CalendarRange,
        Check,
        Copy,
        DollarSign,
        MapPin,
        Mountain,
        QrCode,
        SquarePen,
        Tag,
        TrendingUp,
        Wine
    } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { focusRing, iconButton } from '#lib/components/layout/button-states.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import type { BottleWithDefinitionDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { preferences } from '#lib/stores/preferences.svelte.js';
    import { drinkingDates } from '#lib/utils/bottle-sort.js';
    import { formatCurrency, formatDate } from '#lib/utils/format.js';
    import { availabilityLabel } from './availability.js';
    import DrinkingChip from './DrinkingChip.svelte';
    import { markedRank, windowText } from './drinking.js';

    type Bottle = BottleWithDefinitionDTO;

    /** A bottle of the wine page, still owned or consumed. */
    let {
        bottle,
        onStatus,
        onDuplicate,
        onEdit,
        onBarcode
    }: {
        bottle: Bottle;
        onStatus: (bottle: Bottle) => void;
        onDuplicate: (bottle: Bottle) => void;
        onEdit: (bottle: Bottle) => void;
        onBarcode: (bottle: Bottle) => void;
    } = $props();

    const consumed = $derived(bottle.availability === BottleAvailability.CONSUMED);
    const dates = $derived(drinkingDates(bottle));
    const drinkingWindow = $derived(windowText(dates));
    // Only a bottle in the cellar is to drink, as in the bottle tables.
    const rank = $derived(
        bottle.availability === BottleAvailability.AVAILABLE
            ? markedRank(dates, preferences.drinkingHorizon)
            : null
    );

    const headerBadge =
        'text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 min-h-[32px] sm:min-h-[36px] flex items-center';
    // An availability keeps a fixed fill in every theme (green available, grey out), as
    // AvailabilityBadge does, with white text on it.
    const pill =
        'text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm min-h-[32px] sm:min-h-[36px] flex items-center';
</script>

<!-- The pill of a bottle still owned: a button that changes its status, for a signed-in user -->
{#snippet statusPill(colour: string, text: string)}
    {#if auth.isAuthenticated}
        <button
            class="{colour} {pill} {focusRing} transition-colors"
            onclick={() => onStatus(bottle)}
            title={m['wine_details.click_to_mark_consumed']()}
        >
            {text}
        </button>
    {:else}
        <div class="{colour} {pill}">{text}</div>
    {/if}
{/snippet}

<div
    class="border rounded-lg p-3 hover:shadow-md transition-shadow relative group"
    class:opacity-75={consumed}
>
    <!-- The cards of a row share its height: the consumed date and the notes keep to the bottom,
         level from card to card whatever the lines above them hold -->
    <div class="flex h-full flex-col gap-3">
        <!-- Wraps, so that the buttons stay inside a narrow card -->
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" class={headerBadge}>
                    <Calendar size={16} class="mr-1" />
                    {bottle.vintage ?? m['common.not_available']()}
                </Badge>
                {#if !consumed}
                    <Badge variant="outline" class={headerBadge}>
                        <MapPin size={16} class="mr-1" />
                        {bottle.storageCase?.name || m['common.not_available']()}
                    </Badge>
                {/if}
                <Badge variant="outline" class={headerBadge}>
                    <Wine size={16} class="mr-1" />
                    {bottle.format || m['wine_details.no_format']()}
                </Badge>
            </div>
            <div class="flex items-center gap-2">
                {#if consumed}
                    <Badge variant="destructive" class={headerBadge}>
                        {availabilityLabel(BottleAvailability.CONSUMED)}
                    </Badge>
                {:else if bottle.availability === BottleAvailability.OUT_OF_CELLAR}
                    <!-- The pill has room for a short word only: "Out", not "Out of cellar" -->
                    {@render statusPill('bg-gray-500 hover:bg-gray-600', m['wine_details.out']())}
                {:else}
                    {@render statusPill(
                        'bg-green-700 hover:bg-green-800',
                        availabilityLabel(BottleAvailability.AVAILABLE)
                    )}
                {/if}
                {#if auth.isAuthenticated}
                    <button
                        class={iconButton}
                        onclick={() => onDuplicate(bottle)}
                        title={m['wine_details.duplicate_bottle']()}
                        aria-label={m['wine_details.duplicate_bottle']()}
                    >
                        <Copy size={16} aria-hidden="true" />
                    </button>
                    <button
                        class={iconButton}
                        onclick={() => onEdit(bottle)}
                        title={m['wine_details.edit_bottle']()}
                        aria-label={m['wine_details.edit_bottle']()}
                    >
                        <SquarePen size={16} aria-hidden="true" />
                    </button>
                {/if}
            </div>
        </div>

        <div class="flex flex-wrap gap-1 min-h-[3rem]">
            <button
                class="bg-secondary text-secondary-foreground hover:bg-secondary-hover {focusRing} rounded-lg transition-colors p-2 sm:p-3 min-h-[36px] sm:min-h-[42px] min-w-[36px] sm:min-w-[42px] flex items-center justify-center"
                onclick={() => onBarcode(bottle)}
                title={m['wine_details.view_barcode']()}
                aria-label={m['wine_details.view_barcode']()}
            >
                <QrCode size={20} class="sm:w-6 sm:h-6" />
            </button>
            <Badge variant="secondary" class="text-xs">
                <Calendar size={14} class="mr-1" />
                {formatDate(bottle.purchaseDate)}
            </Badge>
            <Badge variant="secondary" class="text-xs">
                <Tag size={14} class="mr-1" />
                {bottle.origin ? bottle.origin.name : m['wine_details.no_origin']()}
            </Badge>
            <Badge variant="secondary" class="text-xs">
                <DollarSign size={14} class="mr-1" />
                {formatCurrency(bottle.purchasePrice)}
            </Badge>
            <Badge variant="secondary" class="text-xs">
                <TrendingUp size={14} class="mr-1" />
                {formatCurrency(bottle.currentValue)}
            </Badge>
        </div>

        <!-- When to drink it, as the bottle tables say it -->
        {#if rank || drinkingWindow || bottle.optimum !== null}
            <div class="flex flex-wrap items-center gap-1">
                {#if rank}<DrinkingChip {rank} />{/if}
                {#if drinkingWindow}
                    <Badge variant="secondary" class="text-xs">
                        <CalendarRange size={14} class="mr-1" aria-hidden="true" />
                        <span class="sr-only"
                            >{m['common.label']({ label: m['drinking.window_column']() })}</span
                        >
                        {drinkingWindow}
                    </Badge>
                {/if}
                {#if bottle.optimum !== null}
                    <Badge variant="secondary" class="text-xs">
                        <Mountain size={14} class="mr-1" aria-hidden="true" />
                        {m['drinking.optimum_year']({ year: bottle.optimum })}
                    </Badge>
                {/if}
            </div>
        {/if}

        <div class="mt-auto min-h-[1.5rem] flex items-center">
            {#if consumed}
                <Badge
                    variant="destructive"
                    class="text-xs w-full justify-center {bottle.consumedDate ? '' : 'opacity-50'}"
                >
                    <Check size={14} class="mr-1" />
                    {#if bottle.consumedDate}
                        {m['wine_details.consumed_on']()}
                        {formatDate(bottle.consumedDate)}
                    {:else}
                        {m['wine_details.consumed_no_date']()}
                    {/if}
                </Badge>
            {:else if bottle.consumedDate}
                <Badge variant="outline" class="text-xs w-full justify-center">
                    {m['wine_details.consumed_on']()}
                    {formatDate(bottle.consumedDate)}
                </Badge>
            {/if}
        </div>

        <div class="text-xs bg-muted/50 p-2 rounded min-h-[2rem] flex items-center">
            <strong class="text-foreground mr-1"
                >{m['common.label']({ label: m['common.notes']() })}</strong
            >
            <span class="text-muted-foreground">{bottle.notes || m['wine_details.no_notes']()}</span
            >
        </div>
    </div>
</div>
