<script lang="ts">
    import { onMount } from 'svelte';
    import { X } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { CaseLoads } from '#lib/components/forms/case-loads.svelte.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import * as Select from '#lib/components/ui/select/index.js';
    import type { Jsonified, StorageCase } from '#lib/shared/dto.js';
    import { bottlesComingIn, caseLeft, type MovedBottle } from './case-move.js';

    /**
     * The case that bottles move to, chosen among the cases container by container, each with its
     * free places: a case without room for the bottles, or the one they all leave, cannot be
     * chosen. Shows how full the case chosen will be, and how full the case they leave will be.
     */
    let {
        caseId = $bindable(''),
        // An output: the picker sets it, the screen reads it.
        // eslint-disable-next-line no-useless-assignment
        overfilled = $bindable(false),
        bottles,
        label,
        hint,
        disabled = false
    }: {
        caseId?: string;
        /** Whether the case chosen has no room for the bottles, which the screen then refuses to
         * send: the bottles chosen, or the free places, may change after the case was chosen. */
        overfilled?: boolean;
        /** The bottles that move. */
        bottles: MovedBottle[];
        label?: string;
        hint?: string;
        disabled?: boolean;
    } = $props();

    const loads = new CaseLoads();
    onMount(() => loads.load());

    const leaving = $derived(caseLeft(bottles));
    const incoming = (caseId: string) => bottlesComingIn(bottles, caseId);
    const current = $derived(loads.find(leaving?.caseId));
    const target = $derived(loads.find(caseId));
    const fits = (storageCase: Jsonified<StorageCase>) =>
        incoming(storageCase.id) <= loads.free(storageCase);

    $effect.pre(() => {
        overfilled = !!target && !fits(target);
    });

    const id = $props.id();
</script>

<!-- `change` bottles come in (positive) or leave (negative) -->
{#snippet caseLoad(title: string, storageCase: Jsonified<StorageCase>, change: number)}
    {@const used = loads.used(storageCase.id)}
    {@const after = used + change}
    {@const tooFull = change > 0 && !fits(storageCase)}
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
        <p
            class="text-xs {tooFull ? 'text-destructive font-medium' : 'text-muted-foreground'}"
            role={tooFull ? 'alert' : undefined}
        >
            {m['common.label']({ label: m['admin.after_move']() })}
            {after}/{storageCase.capacity}
            {#if tooFull}
                - {m['admin.case_will_be_overfilled']()}
            {/if}
        </p>
    </div>
{/snippet}

<div class="space-y-4">
    {#if current}
        {@render caseLoad(m['admin.current_storage_case'](), current, -leaving!.count)}
    {/if}

    <div class="space-y-2">
        {#if label}
            <Label for="{id}-case">{label}</Label>
        {/if}
        <div class="flex items-start gap-2">
            <Select.Root type="single" bind:value={caseId} disabled={disabled || loads.loading}>
                <Select.Trigger id="{id}-case" class="flex-1 w-full">
                    {#if target}
                        {target.name}
                    {:else}
                        <span class="text-muted-foreground">
                            {loads.loading ? m['admin.loading']() : m['bottles.choose_case']()}
                        </span>
                    {/if}
                </Select.Trigger>
                <Select.Content class="max-h-72">
                    {#each loads.byContainer as container (container.id)}
                        <Select.Group>
                            <Select.GroupHeading class="font-semibold">
                                {container.name}
                            </Select.GroupHeading>
                            {#each container.cases as storageCase (storageCase.id)}
                                {@const free = loads.free(storageCase)}
                                {@const unavailable =
                                    storageCase.id === leaving?.caseId || !fits(storageCase)}
                                <!-- bits-ui marks a disabled option for the styles only: a screen
                                     reader hears it with aria-disabled. -->
                                <Select.Item
                                    value={storageCase.id}
                                    label={storageCase.name}
                                    disabled={unavailable}
                                    aria-disabled={unavailable}
                                >
                                    <span class="flex-1">{storageCase.name}</span>
                                    <span class="text-xs text-muted-foreground">
                                        {#if storageCase.id === leaving?.caseId}
                                            {m['admin.current_storage_case']()}
                                        {:else if free === 0}
                                            {m['forms.full']()}
                                        {:else}
                                            {m['common.places_free']({ count: free })}
                                        {/if}
                                    </span>
                                </Select.Item>
                            {/each}
                        </Select.Group>
                    {/each}
                </Select.Content>
            </Select.Root>
            {#if caseId}
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => (caseId = '')}
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
        {@render caseLoad(m['admin.target_storage_case'](), target, incoming(target.id))}
    {/if}
</div>
