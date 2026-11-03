<script lang="ts">
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import type { DrinkingRank } from '#lib/shared/drinking.js';
    import { rankLabel } from './drinking.js';

    /**
     * How soon to drink a bottle, as a chip, a late one in the destructive colour; with `count`,
     * how many bottles of a list have that rank: « 2 en retard ».
     */
    let { rank, count }: { rank: DrinkingRank; count?: number } = $props();

    const TONES: Record<DrinkingRank, string> = {
        late: '',
        this_month: 'border-warning/50 bg-warning/10 text-warning',
        this_year: 'border-primary/40 bg-primary/10 text-primary-text',
        optimum_reached: 'text-muted-foreground',
        later: 'text-muted-foreground'
    };

    const COUNTED: Partial<Record<DrinkingRank, (inputs: { count: number }) => string>> = {
        late: m['drinking.count_late'],
        this_month: m['drinking.count_this_month'],
        this_year: m['drinking.count_this_year'],
        optimum_reached: m['drinking.count_optimum_reached']
    };

    const text = $derived(
        count !== undefined && COUNTED[rank] ? COUNTED[rank]({ count }) : rankLabel(rank)
    );
</script>

<Badge variant={rank === 'late' ? 'destructive' : 'outline'} class={TONES[rank]}>{text}</Badge>
