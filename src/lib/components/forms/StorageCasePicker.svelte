<script lang="ts">
    import { onMount } from 'svelte';
    import { m } from '#lib/paraglide/messages.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import { CaseLoads } from './case-loads.svelte.js';
    import CaseLoadRow from './CaseLoadRow.svelte';
    import FormField from './FormField.svelte';

    /**
     * The case of a bottle, the field the form sends, with how full the case chosen is. The server
     * refuses a bottle that a full case cannot take (409 case_full), which `error` then shows.
     */
    let { storageCaseId = $bindable(''), error }: { storageCaseId?: string; error?: string } =
        $props();

    const loads = new CaseLoads();
    onMount(() => loads.load());

    const chosen = $derived(loads.find(storageCaseId));
</script>

<FormField
    label={m['forms.storage_case']()}
    {error}
    hint={chosen ? undefined : m['forms.storage_location_tracking']()}
>
    <SearchableSelect
        name="storageCaseId"
        bind:value={storageCaseId}
        options={loads.cases}
        placeholder={m['forms.search_storage_cases']()}
        isLoading={loads.loading}
        valueField="id"
        autoFocus={false}
    />
    {#if chosen}
        {@const used = loads.used(chosen.id)}
        <CaseLoadRow title={chosen.name} count={used} {used} capacity={chosen.capacity} />
    {/if}
</FormField>
