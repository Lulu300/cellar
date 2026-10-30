<script lang="ts">
    import { invalidate } from '$app/navigation';
    import { Trash } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import NumberInput from '#lib/components/forms/NumberInput.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { CELLAR } from '#lib/shared/dependencies.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { apiErrorMessage } from '#lib/utils/api-error.js';
    import { caseKey, MAX_NEW_CASES, type ContainerDraft } from './container-draft.svelte.js';

    /**
     * Creates a container, or edits one, from a draft: nothing is sent before the user saves, and
     * cancelling sends nothing. The server refuses to delete a case that holds bottles in the
     * cellar, and to lower a capacity below them: the dialog stays open with its draft, and says
     * why, under the field concerned when there is one.
     */
    let { open = $bindable(false), draft }: { open?: boolean; draft: ContainerDraft } = $props();

    const container = $derived(draft.container);
    let busy = $state(false);
    // Save is greyed without a name: the field says why before any click.
    const nameMissing = $derived(!draft.name.trim());
    const nameMessageId = $derived(
        draft.errors.name
            ? 'container-name-error'
            : nameMissing
              ? 'container-name-missing'
              : undefined
    );

    /** Sends a request; on success, reloads the page data, says `success` and closes. */
    async function send(request: () => Promise<Response>, success: string, failure: string) {
        busy = true;
        try {
            const response = await request();
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                if (!draft.showRefusal(body)) toasts.add(apiErrorMessage(body), 'error', 8000);
                return;
            }
            await invalidate(CELLAR);
            toasts.add(success, 'success');
            open = false;
        } catch {
            toasts.add(failure, 'error');
        } finally {
            busy = false;
        }
    }

    function save() {
        if (!draft.check()) {
            // Such as more cases than the server takes, which no field shows.
            if (!draft.showsErrors) toasts.add(m['errors.invalid_body'](), 'error', 5000);
            return;
        }
        const init = {
            method: container ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft.body())
        };
        return container
            ? send(
                  () => fetch(`/api/storage-containers/${container.id}`, init),
                  m['storage.container_updated'](),
                  m['storage.failed_to_update_container']()
              )
            : send(
                  () => fetch('/api/storage-containers', init),
                  m['storage.container_created'](),
                  m['storage.failed_to_create_container']()
              );
    }

    async function deleteContainer() {
        if (!container) return;
        const message = m['storage.confirm_delete_container']({ name: container.name });
        if (!(await confirm({ message }))) return;
        return send(
            () => fetch(`/api/storage-containers/${container.id}`, { method: 'DELETE' }),
            m['storage.container_deleted'](),
            m['storage.failed_to_delete_container']()
        );
    }
</script>

<!-- Not closed while a request runs: its answer, such as a refusal, belongs to the open draft. -->
<Dialog
    bind:open={
        () => open,
        (value) => {
            if (!busy) open = value;
        }
    }
>
    <DialogContent class="sm:max-w-3xl max-h-[95vh] overflow-y-auto" showCloseButton={!busy}>
        <DialogHeader>
            <DialogTitle>
                {container ? m['storage.edit_container']() : m['storage.add_new_container']()}
            </DialogTitle>
        </DialogHeader>

        <div class="space-y-6 py-4">
            <div class="space-y-2">
                <Label for="container-name">{m['storage.container_name']()}</Label>
                <Input
                    id="container-name"
                    bind:value={draft.name}
                    oninput={() => draft.forget('name')}
                    placeholder={m['storage.container_name_placeholder']()}
                    aria-invalid={draft.errors.name ? true : undefined}
                    aria-describedby={nameMessageId}
                />
                {#if draft.errors.name}
                    <p id="container-name-error" class="text-sm text-destructive">
                        {draft.errors.name}
                    </p>
                {:else if nameMissing}
                    <p id="container-name-missing" class="text-sm text-muted-foreground">
                        {m['storage.container_name_missing']()}
                    </p>
                {/if}
            </div>

            {#if !container}
                <div class="space-y-2">
                    <Label for="cases-count">{m['storage.number_of_cases']()}</Label>
                    <Input
                        id="cases-count"
                        type="number"
                        min="1"
                        max={MAX_NEW_CASES}
                        bind:value={
                            () => draft.count,
                            // Left empty while the user types another number.
                            (count) => {
                                if (count) draft.count = count;
                            }
                        }
                    />
                    <p class="text-sm text-muted-foreground">{m['storage.cases_count_help']()}</p>
                </div>
            {/if}

            <div class="space-y-3">
                <div>
                    <Label>{container ? m['storage.cases']() : m['storage.case_names']()}</Label>
                    <p class="text-sm text-muted-foreground">
                        {m['storage.case_format_note']()}
                        <strong
                            >{draft.name || m['storage.container']()}[{m[
                                'storage.case_name'
                            ]()}]</strong
                        >
                    </p>
                    {#if container}
                        <p class="text-sm text-muted-foreground mt-1">
                            {m['storage.case_management_help']()}
                        </p>
                    {/if}
                </div>

                <div class="space-y-2 max-h-[50vh] overflow-y-auto border rounded-lg p-3">
                    {#each draft.cases as storageCase, index (storageCase)}
                        {@const error = draft.errors[caseKey(index)]}
                        <div class="flex flex-wrap items-center gap-2 rounded-md p-1 text-sm">
                            <span class="text-muted-foreground w-20 shrink-0">
                                {m['storage.case_number']({ number: index + 1 })}
                            </span>
                            <span class="font-medium max-w-24 truncate">
                                {draft.name || m['storage.container']()}
                            </span>
                            <Input
                                bind:value={storageCase.suffix}
                                oninput={() => draft.forget(caseKey(index))}
                                aria-label={m['storage.case_name']()}
                                aria-invalid={error ? true : undefined}
                                class="flex-1 min-w-16"
                            />
                            <Label class="text-xs text-muted-foreground font-normal">
                                {m['storage.capacity']()}
                                <NumberInput
                                    bind:value={storageCase.capacity}
                                    oninput={() => draft.forget(caseKey(index))}
                                    aria-invalid={error ? true : undefined}
                                    class="w-20 text-center"
                                />
                            </Label>
                            {#if container}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => draft.remove(index)}
                                    aria-label={m['storage.remove_case']({
                                        name: `${draft.name}${storageCase.suffix}`
                                    })}
                                    class="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                >
                                    <Trash class="h-3 w-3" />
                                </Button>
                            {/if}
                            {#if error}
                                <p class="w-full text-sm text-destructive">{error}</p>
                            {/if}
                        </div>
                    {/each}
                </div>

                {#if container}
                    <Button variant="outline" onclick={() => draft.add()}>
                        + {m['storage.add_case']()}
                    </Button>
                {/if}
            </div>
        </div>

        <div class="flex flex-wrap justify-between gap-3 pt-4 border-t">
            {#if container}
                <Button variant="destructive" onclick={deleteContainer} disabled={busy}>
                    <Trash class="h-4 w-4 mr-2" />
                    {m['storage.delete_container']()}
                </Button>
            {/if}
            <div class="flex gap-3 ml-auto">
                <Button variant="outline" onclick={() => (open = false)} disabled={busy}>
                    {m['common.cancel']()}
                </Button>
                <Button onclick={save} disabled={busy || nameMissing}>
                    {container ? m['storage.update_container']() : m['storage.create_container']()}
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
