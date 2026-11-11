<script lang="ts">
    import type { Snippet } from 'svelte';
    import { CircleCheck, CircleAlert, History } from '@lucide/svelte';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import SearchableSelect from '#lib/components/forms/SearchableSelect.svelte';
    import { m } from '#lib/paraglide/messages.js';
    import type { CsvAnswer, CsvIssueDTO, CsvReviewDTO } from '#lib/shared/dto.js';
    import { issueReason, issueRows, issueTitle, wineDetails, wineLabel } from './texts.js';

    let {
        issue,
        review,
        answer,
        suggested,
        onAnswer
    }: {
        issue: CsvIssueDTO;
        review: CsvReviewDTO;
        answer: CsvAnswer | undefined;
        /** Whether the answer is the suggestion of an earlier import, not changed since. */
        suggested: boolean;
        onAnswer: (answer: CsvAnswer | undefined) => void;
    } = $props();

    const uid = $props.id();
    // The parent that « Créer » asks for: the country of a region, the region of an appellation.
    const PARENT_LABELS: Partial<Record<string, () => string>> = {
        countries: m['common.country'],
        regions: m['common.region']
    };
    type Mode = 'use' | 'create' | 'blank' | 'correct' | 'wine' | 'other-wine' | 'ignore';

    /** The choice that an answer stands for, which the radio buttons show. */
    function modeOf(answer: CsvAnswer | undefined): Mode | undefined {
        switch (answer?.action) {
            case 'ignore':
                return 'ignore';
            case 'create':
                return 'create';
            case 'set':
                if (answer.value === '') return 'blank';
                return issue.kind === 'cell' ? 'correct' : 'use';
            case 'wine':
                return issue.wines?.some((wine) => sameWine(wine.wine, answer.wine))
                    ? 'wine'
                    : 'other-wine';
        }
    }

    const sameWine = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

    // A choice that needs a value, such as a name to create, is shown before it is complete: the
    // answer is sent once it is.
    let picked = $state<Mode | undefined>();
    const mode = $derived(picked ?? modeOf(answer));
    let createName = $state('');
    let createParent = $state('');
    let correction = $state('');
    $effect.pre(() => {
        createName = answer?.action === 'create' ? answer.value : (issue.value ?? '');
        createParent = answer?.action === 'create' ? (answer.parent ?? '') : (issue.parent ?? '');
        correction =
            answer?.action === 'set' && issue.kind === 'cell' ? answer.value : (issue.value ?? '');
    });

    /** A name of the list with that of its parent, as an option of a list with search. */
    const optionOf = (named: { name: string; parent?: string }) => ({
        id: JSON.stringify([named.name, named.parent ?? null]),
        name: named.parent ? `${named.name} (${named.parent})` : named.name
    });
    const targetOptions = $derived((issue.target ? review.names[issue.target] : [])?.map(optionOf));
    const parentOptions = $derived(
        (issue.parentTarget ? review.names[issue.parentTarget] : [])?.map((named) => ({
            id: named.name,
            name: named.name
        }))
    );
    const wineOptions = $derived(
        review.wines.map((wine) => ({ id: JSON.stringify(wine.wine), name: wineLabel(wine) }))
    );
    const usedOption = $derived(
        answer?.action === 'set' && mode === 'use'
            ? JSON.stringify([answer.value, answer.parent ?? null])
            : ''
    );
    const otherWine = $derived(
        answer?.action === 'wine' && mode === 'other-wine' ? JSON.stringify(answer.wine) : ''
    );

    function choose(next: Mode) {
        picked = next;
        if (next === 'ignore') send({ action: 'ignore' });
        else if (next === 'blank') send({ action: 'set', value: '' });
        else if (next === 'create') sendCreate();
        // The text of the file is not valid: a correction is sent once it is typed.
    }

    function send(next: CsvAnswer | undefined) {
        picked = undefined;
        onAnswer(next);
    }

    function useName(close: string) {
        const option = targetOptions?.find((option) => JSON.parse(option.id)[0] === close);
        if (option) useOption(option.id);
    }

    function useOption(id: string) {
        if (!id) return;
        const [value, parent] = JSON.parse(id) as [string, string | null];
        send({ action: 'set', value, ...(parent !== null && { parent }) });
    }

    function sendCreate() {
        const value = createName.trim();
        if (!value || (issue.parentTarget && !createParent)) return;
        send({ action: 'create', value, ...(issue.parentTarget && { parent: createParent }) });
    }

    function sendCorrection() {
        send({ action: 'set', value: correction.trim() });
    }

    const name = `${uid}-choice`;
</script>

<article
    class="space-y-3 rounded-lg border p-3 {issue.open ? 'border-warning/50' : ''}"
    aria-labelledby="{uid}-title"
>
    <header class="space-y-1">
        <div class="flex flex-wrap items-start justify-between gap-2">
            <h3 id="{uid}-title" class="min-w-0 font-medium [overflow-wrap:anywhere]">
                {issueTitle(issue)}
            </h3>
            {#if issue.open}
                <Badge variant="outline" class="gap-1 border-warning/40 text-warning">
                    <CircleAlert class="h-3 w-3" />
                    {m['admin.csv_review_to_settle']()}
                </Badge>
            {:else}
                <Badge variant="outline" class="gap-1 border-success/40 text-success">
                    <CircleCheck class="h-3 w-3" />
                    {m['admin.csv_review_settled']()}
                </Badge>
            {/if}
        </div>
        {#if issue.open && issueReason(issue)}
            <p class="text-sm text-muted-foreground">{issueReason(issue)}</p>
        {/if}
        <p class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{issueRows(issue)}</p>
        {#if suggested}
            <Badge variant="secondary" class="gap-1">
                <History class="h-3 w-3" />
                {m['admin.csv_review_from_previous']()}
            </Badge>
        {/if}
        {#if issue.pending}
            <p class="text-sm text-warning">
                {m['admin.csv_review_pending_wine']({
                    row: issue.pending.row,
                    file: issue.pending.file
                })}
            </p>
        {/if}
    </header>

    {#snippet choice(value: Mode, text: string, controls?: Snippet, checked = mode === value)}
        <div class="flex items-start gap-2">
            <input
                id="{uid}-{value}"
                type="radio"
                {name}
                {checked}
                onchange={() => choose(value)}
                class="mt-1"
            />
            <div class="min-w-0 flex-1 space-y-2">
                <label for="{uid}-{value}" class="block [overflow-wrap:anywhere]">{text}</label>
                {#if checked && controls}{@render controls()}{/if}
            </div>
        </div>
    {/snippet}

    <div role="radiogroup" aria-labelledby="{uid}-title" class="space-y-2 text-sm">
        {#if issue.kind === 'reference'}
            {#if targetOptions && targetOptions.length > 0}
                {#snippet useControls()}
                    {#if issue.close && issue.close.length > 0}
                        <div class="flex flex-wrap items-center gap-1">
                            <span class="text-xs text-muted-foreground"
                                >{m['admin.csv_review_close_names']()}</span
                            >
                            {#each issue.close as close (close)}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-7"
                                    onclick={() => useName(close)}>{close}</Button
                                >
                            {/each}
                        </div>
                    {/if}
                    <label for="{uid}-use-list" class="sr-only">{m['admin.csv_review_use']()}</label
                    >
                    <SearchableSelect
                        id="{uid}-use-list"
                        options={targetOptions}
                        valueField="id"
                        autoFocus={false}
                        bind:value={() => usedOption, useOption}
                    />
                {/snippet}
                {@render choice('use', m['admin.csv_review_use'](), useControls)}
            {/if}
            {#if issue.creatable}
                {#snippet createControls()}
                    <Input
                        bind:value={createName}
                        onchange={sendCreate}
                        aria-label={m['admin.csv_review_create']()}
                    />
                    {#if issue.parentTarget && parentOptions}
                        <label for="{uid}-parent" class="block text-xs text-muted-foreground"
                            >{PARENT_LABELS[issue.parentTarget]?.()}</label
                        >
                        <SearchableSelect
                            id="{uid}-parent"
                            options={parentOptions}
                            autoFocus={false}
                            bind:value={
                                () => createParent,
                                (parent) => {
                                    createParent = parent;
                                    sendCreate();
                                }
                            }
                        />
                    {/if}
                {/snippet}
                {@render choice('create', m['admin.csv_review_create'](), createControls)}
            {/if}
            {#if !issue.required}
                {@render choice('blank', m['admin.csv_review_leave_blank']())}
            {/if}
        {:else if issue.kind === 'wine'}
            {#each issue.wines ?? [] as wine (JSON.stringify(wine.wine))}
                {@const id = `${uid}-${JSON.stringify(wine.wine)}`}
                <div class="flex items-start gap-2">
                    <input
                        {id}
                        type="radio"
                        {name}
                        checked={answer?.action === 'wine' && sameWine(answer.wine, wine.wine)}
                        onchange={() => send({ action: 'wine', wine: wine.wine })}
                        class="mt-1"
                    />
                    <label for={id} class="min-w-0 space-y-0.5">
                        <span class="block font-medium [overflow-wrap:anywhere]"
                            >{wineLabel(wine)}</span
                        >
                        <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]"
                            >{wineDetails(wine)}</span
                        >
                    </label>
                </div>
            {/each}
            {#if review.wines.length > 0}
                {#snippet otherWineControls()}
                    <label for="{uid}-wine-list" class="sr-only"
                        >{m['admin.csv_review_other_wine']()}</label
                    >
                    <SearchableSelect
                        id="{uid}-wine-list"
                        options={wineOptions}
                        valueField="id"
                        autoFocus={false}
                        bind:value={
                            () => otherWine,
                            (id) => id && send({ action: 'wine', wine: JSON.parse(id) })
                        }
                    />
                {/snippet}
                {@render choice(
                    'other-wine',
                    m['admin.csv_review_other_wine'](),
                    otherWineControls
                )}
            {/if}
        {:else if issue.kind === 'cell'}
            {#snippet correctControls()}
                <Input
                    bind:value={correction}
                    onchange={sendCorrection}
                    aria-label={m['admin.csv_review_correct']()}
                />
            {/snippet}
            {@render choice('correct', m['admin.csv_review_correct'](), correctControls)}
            {#if !issue.required}
                {@render choice('blank', m['admin.csv_review_leave_blank']())}
            {/if}
        {:else}
            <p class="text-muted-foreground">{m['admin.csv_review_only_ignore']()}</p>
        {/if}
        {@render choice('ignore', m['admin.csv_review_ignore_rows']({ count: issue.count }))}
    </div>
</article>
