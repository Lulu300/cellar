<script lang="ts">
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { BottleAvailability } from '#lib/shared/bottle-availability.js';
    import { availabilityLabel } from './availability.js';

    let { availability }: { availability: string } = $props();
</script>

{#if availability === BottleAvailability.OUT_OF_CELLAR}
    <Badge variant="secondary">{availabilityLabel(availability)}</Badge>
{:else if availability === BottleAvailability.CONSUMED}
    <Badge variant="destructive">{availabilityLabel(availability)}</Badge>
{:else}
    <!-- Green whatever the colour of the theme -->
    <Badge class="bg-emerald-700 text-white">{availabilityLabel(availability)}</Badge>
{/if}
