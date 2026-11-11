<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { errorMessage, request } from '#lib/api/client.js';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import type { ProducerDTO } from '#lib/shared/dto.js';
    import { MERGED_FIELDS, type MergedField } from '#lib/shared/schemas/producer.js';
    import { toasts } from '#lib/stores/toast.svelte.js';

    /**
     * Merges a producer into another: the user picks both, then, for each field that both fill
     * differently, the value to keep. The server refuses a merge that would drop a value without
     * a choice.
     */
    let {
        open = $bindable(false),
        producers,
        imageUrls
    }: {
        open: boolean;
        producers: ProducerDTO[];
        /** The URL of each image by its id, for the photos. */
        imageUrls: Map<string, string>;
    } = $props();

    let keptId = $state('');
    let mergedId = $state('');
    let choices = $state<Partial<Record<MergedField, 'kept' | 'merged'>>>({});
    let merging = $state(false);
    const missingId = $props.id();

    $effect(() => {
        if (!open) return;
        keptId = '';
        mergedId = '';
    });
    // Other producers, other choices.
    $effect(() => {
        void keptId;
        void mergedId;
        choices = {};
    });

    const kept = $derived(producers.find((producer) => producer.id === keptId));
    const merged = $derived(producers.find((producer) => producer.id === mergedId));

    const LABELS: Record<MergedField, () => string> = {
        place: () => m['admin.merge_place'](),
        website: () => m['common.website'](),
        contact: () => m['producers.contact'](),
        description: () => m['common.description'](),
        imageId: () => m['producers.photo']()
    };

    /** What the field holds, as compared and shown; '' for nothing. */
    function valueOf(producer: ProducerDTO, field: MergedField): string {
        if (field === 'place') {
            return [producer.regionName, producer.countryName].filter(Boolean).join(', ');
        }
        return producer[field] ?? '';
    }

    const fields = $derived(
        kept && merged
            ? MERGED_FIELDS.map((field) => {
                  const keptValue = valueOf(kept, field);
                  const mergedValue = valueOf(merged, field);
                  const state =
                      !mergedValue || mergedValue === keptValue
                          ? 'kept'
                          : keptValue
                            ? 'choice'
                            : 'taken';
                  return { field, keptValue, mergedValue, state };
              })
            : []
    );
    const toChoose = $derived(fields.filter((row) => row.state === 'choice'));
    const taken = $derived(fields.filter((row) => row.state === 'taken'));
    const chosen = $derived(toChoose.every(({ field }) => choices[field]));
    const complete = $derived(!!kept && !!merged && chosen);

    async function merge() {
        if (!complete || merging || !kept || !merged) return;
        merging = true;
        try {
            await request('/api/admin/merge-producers', {
                method: 'POST',
                json: { keptId, mergedId, choices }
            });
            toasts.add(
                m['admin.merge_done']({
                    merged: merged.name,
                    kept: kept.name,
                    count: merged.wineCount
                }),
                'success'
            );
            open = false;
            await invalidateAll();
        } catch (error) {
            toasts.add(errorMessage(error), 'error', 8000);
        } finally {
            merging = false;
        }
    }
</script>

{#snippet shown(field: MergedField, value: string)}
    {#if !value}
        <span class="text-muted-foreground">—</span>
    {:else if field === 'imageId'}
        {#if imageUrls.get(value)}
            <img src={imageUrls.get(value)} alt="" class="h-20 w-15 rounded-md object-cover" />
        {/if}
    {:else}
        <span class="line-clamp-3 whitespace-pre-line [overflow-wrap:anywhere]">{value}</span>
    {/if}
{/snippet}

<Dialog bind:open>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>{m['admin.merge_producers']()}</DialogTitle>
            <DialogDescription>{m['admin.merge_intro']()}</DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 sm:grid-cols-2">
            <FormField label={m['admin.merge_kept']()}>
                <SearchableSelect
                    bind:value={keptId}
                    options={producers.filter((producer) => producer.id !== mergedId)}
                    placeholder={m['admin.merge_choose_kept']()}
                    valueField="id"
                />
            </FormField>
            <FormField label={m['admin.merge_merged']()}>
                <SearchableSelect
                    bind:value={mergedId}
                    options={producers.filter((producer) => producer.id !== keptId)}
                    placeholder={m['admin.merge_choose_merged']()}
                    valueField="id"
                />
            </FormField>
        </div>

        {#if kept && merged}
            <div class="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <p>{m['producers.n_wines']({ count: kept.wineCount })}</p>
                <p>{m['producers.n_wines']({ count: merged.wineCount })}</p>
            </div>
            {#if toChoose.length > 0}
                <fieldset class="space-y-3">
                    <legend class="mb-2 text-sm font-medium">{m['admin.merge_choices']()}</legend>
                    {#each toChoose as { field, keptValue, mergedValue } (field)}
                        <div class="rounded-md border p-3">
                            <p class="mb-2 text-sm font-medium">{LABELS[field]()}</p>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <!-- Each value says whose it is: on a phone, the pickers above
                                     stack while these columns stay side by side -->
                                {#each [[kept, keptValue, 'kept'], [merged, mergedValue, 'merged']] as const as [producer, value, side] (side)}
                                    <label class="flex items-start gap-2">
                                        <input
                                            type="radio"
                                            name="merge-{field}"
                                            value={side}
                                            bind:group={choices[field]}
                                            class="mt-1"
                                        />
                                        <span class="min-w-0 space-y-1">
                                            <span
                                                class="block text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]"
                                                >{producer.name}</span
                                            >
                                            {@render shown(field, value)}
                                        </span>
                                    </label>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </fieldset>
            {/if}
            {#if taken.length > 0}
                <p class="text-sm">
                    {m['admin.merge_taken']({
                        fields: taken.map(({ field }) => LABELS[field]()).join(', ')
                    })}
                </p>
            {/if}
        {/if}

        <DialogFooter class="gap-2">
            {#if kept && merged && !chosen}
                <p id={missingId} class="text-xs text-muted-foreground sm:me-auto">
                    {m['errors.merge_choice_needed']()}
                </p>
            {/if}
            <Button variant="outline" onclick={() => (open = false)}>{m['common.cancel']()}</Button>
            <Button
                onclick={merge}
                disabled={!complete || merging}
                aria-describedby={kept && merged && !chosen ? missingId : undefined}
            >
                {m['admin.merge_confirm']()}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
