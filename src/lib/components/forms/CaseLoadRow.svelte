<script lang="ts">
    import { Package } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';

    /** A case, how full it is, and how many bottles of interest it holds. */
    let {
        title,
        count,
        used,
        capacity
    }: {
        title: string;
        /** The bottles that the badge counts: the wine's, or all of them. */
        count: number;
        /** The available bottles in the case, which take a place each. */
        used: number;
        capacity: number;
    } = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
    <div class="flex items-center gap-2">
        <Package class="h-4 w-4 text-muted-foreground" />
        <div>
            <div class="text-sm font-medium">{title}</div>
            <div class="text-xs text-muted-foreground">
                {m['common.places_used']({ used, capacity })}
            </div>
        </div>
    </div>
    <div class="flex items-center gap-2">
        <Badge variant="outline" class="text-xs">
            {m['common.n_bottles']({ count })}
        </Badge>
        {#if used < capacity}
            <Badge variant="default" class="border-success/30 bg-success/10 text-xs text-success">
                {m['common.places_free']({ count: capacity - used })}
            </Badge>
        {:else}
            <Badge variant="destructive" class="text-xs">{m['forms.full']()}</Badge>
        {/if}
    </div>
</div>
