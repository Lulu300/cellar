<script lang="ts">
    import { onMount } from 'svelte';
    import { request } from '#lib/api/client.js';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import type { AppellationDTO, Jsonified, ReferencesDTO } from '#lib/shared/dto.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import FormField from './FormField.svelte';
    import { createReference } from './references.js';

    type Appellation = Jsonified<AppellationDTO>;

    /**
     * The appellation of a wine, the field the form sends, with its country and region. Choosing
     * an appellation shows its country and region; while none is chosen, a country and a region
     * narrow the appellations offered, and a new appellation goes in the region chosen.
     */
    let { appellationId = $bindable(''), error }: { appellationId?: string; error?: string } =
        $props();

    const references: ReferencesDTO = $derived(page.data.references);

    // Every appellation, with its region and country: the layout leaves this long list out.
    let appellations = $state<Appellation[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            appellations = await request<Appellation[]>('/api/appellations');
        } catch {
            toasts.add(m['wine_form.appellations_not_loaded'](), 'error', 5000);
        } finally {
            loading = false;
        }
    });

    // Chosen by hand while no appellation is chosen
    let chosenCountryId = $state('');
    let chosenRegionId = $state('');

    const appellation = $derived(appellations.find(({ id }) => id === appellationId));
    const countryId = $derived(appellation?.countryId ?? chosenCountryId);
    const regionId = $derived(appellation?.regionId ?? chosenRegionId);

    const regionOptions = $derived(
        countryId
            ? references.regions.filter((region) => region.countryId === countryId)
            : references.regions
    );
    const appellationOptions = $derived(
        appellations.filter(
            (row) =>
                (!regionId || row.regionId === regionId) &&
                (!countryId || row.countryId === countryId)
        )
    );

    function chooseAppellation(id: string) {
        // Cleared, it leaves its country and region chosen.
        if (!id) [chosenCountryId, chosenRegionId] = [countryId, regionId];
        appellationId = id;
    }

    function chooseCountry(id: string) {
        chosenCountryId = id;
        chosenRegionId = '';
    }

    function chooseRegion(id: string) {
        chosenRegionId = id;
        const region = references.regions.find((row) => row.id === id);
        if (region) chosenCountryId = region.countryId;
    }

    const createCountry = (name: string) => createReference('/api/countries', { name });
    const createRegion = (name: string) => createReference('/api/regions', { name, countryId });

    async function createAppellation(name: string) {
        const created = await createReference<Appellation>('/api/appellations', {
            name,
            regionId
        });
        appellations = [...appellations, created];
        return created;
    }
</script>

<div class="grid gap-4 sm:grid-cols-3">
    <FormField
        label="{m['common.appellation']()} *"
        {error}
        hint={m['forms.appellation_auto_fills']()}
    >
        <SearchableSelect
            name="appellationId"
            bind:value={() => appellationId, chooseAppellation}
            options={appellationOptions}
            placeholder={m['forms.search_appellations_placeholder']()}
            allowCreate={!!regionId}
            onCreate={createAppellation}
            isLoading={loading}
            valueField="id"
        />
    </FormField>
    <FormField label={m['common.country']()}>
        <SearchableSelect
            bind:value={() => countryId, chooseCountry}
            options={references.countries}
            placeholder={m['forms.auto_filled']()}
            allowCreate
            onCreate={createCountry}
            valueField="id"
            disabled={!!appellation}
        />
    </FormField>
    <FormField label={m['common.region']()}>
        <SearchableSelect
            bind:value={() => regionId, chooseRegion}
            options={regionOptions}
            placeholder={m['forms.auto_filled']()}
            allowCreate={!!countryId}
            onCreate={createRegion}
            valueField="id"
            disabled={!!appellation}
        />
    </FormField>
</div>
