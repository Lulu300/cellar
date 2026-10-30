<script lang="ts">
    import {
        Calendar,
        Check,
        Copy,
        DollarSign,
        MapPin,
        QrCode,
        SquarePen,
        Tag,
        TrendingUp,
        Wine
    } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import type { BottleWithDefinitionDTO } from '#lib/shared/dto.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { formatCurrency, formatDate } from '#lib/utils/format.js';
    import { availabilityLabel } from './availability.js';

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

    const headerBadge =
        'text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 min-h-[32px] sm:min-h-[36px] flex items-center';
    // An availability keeps a fixed fill in every theme (green available, grey out), as
    // AvailabilityBadge does, with white text on it.
    const pill =
        'text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm min-h-[32px] sm:min-h-[36px] flex items-center';
    const iconButton =
        'text-muted-foreground hover:text-foreground transition-colors rounded p-2 sm:p-2.5 text-sm sm:text-base min-h-[32px] sm:min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center';
</script>

<!-- The pill of a bottle still owned: a button that changes its status, for a signed-in user -->
{#snippet statusPill(colour: string, text: string)}
    {#if auth.isAuthenticated}
        <button
            class="{colour} {pill} cursor-pointer transition-colors"
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
    <div class="space-y-3">
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
                class="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors p-2 sm:p-3 min-h-[36px] sm:min-h-[42px] min-w-[36px] sm:min-w-[42px] flex items-center justify-center"
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

        <div class="min-h-[1.5rem] flex items-center">
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
