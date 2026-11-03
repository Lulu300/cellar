<script lang="ts">
    import { Badge } from '#lib/components/ui/badge/index.js';
    import type { DrinkingRank } from '#lib/shared/drinking.js';
    import { countedLabel, rankLabel } from './drinking.js';
    import DrinkingMark from './DrinkingMark.svelte';

    /**
     * How soon to drink a bottle, as a chip led by the shape of its rank and tinted with its
     * colour; with `count`, how many bottles of a list have that rank: « 2 en retard ».
     */
    let { rank, count }: { rank: DrinkingRank; count?: number } = $props();

    // Outlined, the late one too: a red triangle would not show on a solid red chip.
    const TONES: Record<DrinkingRank, string> = {
        late: 'border-destructive/50 bg-destructive/10 text-destructive',
        this_month: 'border-warning/50 bg-warning/10 text-warning',
        this_year: 'border-primary/40 bg-primary/10 text-primary-text',
        optimum_reached: 'border-success/50 bg-success/10 text-success',
        later: 'text-muted-foreground'
    };

    const text = $derived(count === undefined ? rankLabel(rank) : countedLabel(rank, count));
</script>

<Badge variant="outline" class="gap-1 {TONES[rank]}">
    <DrinkingMark {rank} size={10} />
    {text}
</Badge>
