<script lang="ts">
    import { onMount } from 'svelte';
    import { X } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { CaseLoads } from '#lib/components/forms/case-loads.svelte.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import type { Jsonified, StorageCase } from '#lib/shared/dto.js';

    /**
     * The case that bottles move to, with how full it will be, and how full the case they leave
     * will be when they all leave the same one.
     */
    let {
        caseId = $bindable(''),
        incoming,
        currentCaseId,
        label,
        hint,
        disabled = false
    }: {
        caseId?: string;
        /** The bottles that the move brings into the case chosen. */
        incoming: number;
        currentCaseId?: string;
        label?: string;
        hint?: string;
        disabled?: boolean;
    } = $props();

    const loads = new CaseLoads();
    onMount(() => loads.load());

    let select = $state<ReturnType<typeof SearchableSelect>>();
    const current = $derived(loads.find(currentCaseId));
    const target = $derived(loads.find(caseId));
    const id = $props.id();
</script>

<!-- `change` bottles come in (positive) or leave (negative) -->
{#snippet caseLoad(title: string, storageCase: Jsonified<StorageCase>, change: number)}
    {@const used = loads.used(storageCase.id)}
    {@const after = used + change}
    {@const overfilled = change > 0 && after > storageCase.capacity}
    <div class="p-3 bg-muted/50 rounded-lg space-y-1">
        <p class="text-sm font-medium">
            {m['common.label']({ label: title })}
            {storageCase.name}
            {#if change > 0}
                <span class="font-normal text-muted-foreground"
                    >({m['bottles.incoming']({ count: change })})</span
                >
            {/if}
        </p>
        <div class="flex items-center gap-2">
            <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                    class="h-full bg-primary transition-all"
                    style="width: {Math.min(100, (used / storageCase.capacity) * 100)}%"
                ></div>
            </div>
            <span class="text-sm text-muted-foreground">{used}/{storageCase.capacity}</span>
        </div>
        <p class="text-xs {overfilled ? 'text-destructive font-medium' : 'text-muted-foreground'}">
            {m['common.label']({ label: m['admin.after_move']() })}
            {after}/{storageCase.capacity}
            {#if overfilled}
                - {m['admin.case_will_be_overfilled']()}
            {/if}
        </p>
    </div>
{/snippet}

<div class="space-y-4">
    {#if current}
        {@render caseLoad(m['admin.current_storage_case'](), current, -incoming)}
    {/if}

    <div class="space-y-2">
        {#if label}
            <Label for="{id}-case">{label}</Label>
        {/if}
        <div class="flex items-start gap-2">
            <div class="flex-1">
                <SearchableSelect
                    bind:this={select}
                    bind:value={caseId}
                    id="{id}-case"
                    options={loads.cases}
                    placeholder={m['forms.search_storage_cases']()}
                    isLoading={loads.loading}
                    valueField="id"
                    autoFocus={false}
                    {disabled}
                />
            </div>
            {#if caseId}
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => select?.reset()}
                    title={m['bottles.clear_location']()}
                    aria-label={m['bottles.clear_location']()}
                    {disabled}
                >
                    <X class="h-4 w-4" aria-hidden="true" />
                </Button>
            {/if}
        </div>
        {#if hint}
            <p class="text-sm text-muted-foreground">{hint}</p>
        {/if}
    </div>

    {#if target}
        {@render caseLoad(m['admin.target_storage_case'](), target, incoming)}
    {/if}
</div>
