<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { MapPin, LoaderCircle } from '@lucide/svelte';
    import CaseLoadRow from '#lib/components/forms/CaseLoadRow.svelte';
    import { request } from '#lib/api/client.js';
    import type { WineLocationsDTO } from '#lib/shared/dto.js';

    /** Where the bottles of a wine already are, so that new ones can join them. */
    let { definitionId }: { definitionId: string } = $props();

    let locations = $state<WineLocationsDTO | null>(null);
    let failed = $state(false);

    $effect(() => {
        const url = `/api/wines/${definitionId}/locations`;
        // An answer for a wine no longer chosen is dropped.
        let current = true;
        locations = null;
        failed = false;
        request<WineLocationsDTO>(url)
            .then((loaded) => {
                if (current) locations = loaded;
            })
            .catch(() => {
                if (current) failed = true;
            });
        return () => {
            current = false;
        };
    });
</script>

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
            <MapPin class="h-4 w-4" />
            {m['forms.existing_bottle_locations']()}
            {#if locations?.totalBottles}
                <Badge variant="secondary">
                    {m['common.n_bottles']({ count: locations.totalBottles })}
                </Badge>
            {/if}
        </CardTitle>
    </CardHeader>
    <CardContent>
        {#if failed}
            <div class="py-4 text-sm text-destructive">
                {m['bottle_form.locations_not_loaded']()}
            </div>
        {:else if !locations}
            <div class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <LoaderCircle class="h-4 w-4 animate-spin" />
                {m['forms.loading_locations']()}
            </div>
        {:else if locations.locations.length === 0}
            <div class="py-4 text-sm text-muted-foreground">
                {m['forms.no_bottles_stored_yet']()}
            </div>
        {:else}
            <div class="space-y-3">
                <div class="text-sm text-muted-foreground">
                    {m['forms.consider_storing_same_location']()}
                </div>
                <div class="grid gap-2">
                    {#each locations.locations as location (location.caseId)}
                        <CaseLoadRow
                            title="{location.container} → {location.case}"
                            count={location.count}
                            used={location.totalBottlesInCase}
                            capacity={location.capacity}
                        />
                    {/each}
                </div>
            </div>
        {/if}
    </CardContent>
</Card>
