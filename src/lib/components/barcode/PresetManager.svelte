<script lang="ts">
    import { invalidate } from '$app/navigation';
    import { PenLine, Save, Settings, Trash } from '@lucide/svelte';
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
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import ScrollingDialogContent from '#lib/components/layout/ScrollingDialogContent.svelte';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { LABEL_PRESETS } from '#lib/shared/dependencies.js';
    import type { LabelPreset } from '#lib/shared/dto.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { responseErrorMessage } from '#lib/utils/api-error.js';
    import { sendJson } from './api.js';
    import { labelIssueMessage } from './label-issue-message.js';
    import type { LabelOptions } from './label-options.svelte.js';

    /** The saved layouts: apply one to `options`, save `options` as a new one or over one. */
    let { presets, options }: { presets: LabelPreset[]; options: LabelOptions } = $props();

    let selectedId = $state('');
    // The reason why the buttons are disabled, which they name for assistive technologies
    const reasonId = $props.id();
    const describedBy = $derived(options.layoutPrintable ? undefined : reasonId);
    const selected = $derived(presets.find((preset) => preset.id === selectedId));
    // Update is greyed until a preset is applied, and Save until the preset has a name: a line
    // says why, before any click.
    const noneAppliedId = `${reasonId}-none-applied`;
    const nameMissingId = `${reasonId}-name-missing`;

    /** The dialog open: saving a new preset, updating the selected one, or the list. */
    let dialog = $state<'save' | 'update' | 'manage' | null>(null);
    let name = $state('');
    let description = $state('');

    const presetLabel = (preset: LabelPreset) =>
        `${preset.name} - ${preset.description || m['barcode.no_description']()}`;

    function apply(preset: LabelPreset) {
        selectedId = preset.id;
        options.apply(preset);
        toasts.add(m['toast.applied_preset']({ name: preset.name }), 'success');
    }

    function openEditor(kind: 'save' | 'update') {
        name = kind === 'update' ? (selected?.name ?? '') : '';
        description = kind === 'update' ? (selected?.description ?? '') : '';
        dialog = kind;
    }

    async function savePreset() {
        const body = { ...options.layout, name: name.trim(), description: description.trim() };
        const updating = dialog === 'update' && selected;
        try {
            const response = updating
                ? await sendJson('PUT', `/api/admin/label-presets/${selected.id}`, body)
                : await sendJson('POST', '/api/admin/label-presets', body);
            if (!response.ok) {
                const error = await responseErrorMessage(response);
                toasts.add(updating ? error : m['toast.failed_to_save_preset']({ error }), 'error');
                return;
            }
            const preset: Pick<LabelPreset, 'id' | 'name'> = await response.json();
            await invalidate(LABEL_PRESETS);
            selectedId = preset.id;
            dialog = null;
            toasts.add(
                updating
                    ? m['toast.preset_updated_successfully']()
                    : m['toast.saved_preset']({ name: preset.name }),
                'success'
            );
        } catch {
            toasts.add(
                updating ? m['toast.error_updating_preset']() : m['toast.error_saving_preset'](),
                'error'
            );
        }
    }

    async function deletePreset({ id, name }: LabelPreset) {
        // Nothing brings back a preset that Cellar shipped.
        if (!(await confirm({ message: m['barcode.confirm_delete_preset']({ name }) }))) return;
        try {
            const response = await fetch(`/api/admin/label-presets/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await responseErrorMessage(response);
                toasts.add(m['toast.failed_to_delete_preset']({ error }), 'error');
                return;
            }
            await invalidate(LABEL_PRESETS);
            if (selectedId === id) selectedId = '';
            toasts.add(m['toast.preset_deleted_successfully'](), 'success');
        } catch {
            toasts.add(m['toast.error_deleting_preset'](), 'error');
        }
    }
</script>

<div class="space-y-3 p-4 bg-muted/50 rounded-lg">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-medium text-sm">{m['barcode.label_presets']()}</h2>
        <div class="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={!options.layoutPrintable}
                aria-describedby={describedBy}
                onclick={() => openEditor('save')}
            >
                <Save class="h-4 w-4 mr-1" />
                {m['barcode.save_new_preset']()}
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={!selected || !options.layoutPrintable}
                aria-describedby={describedBy ?? (selected ? undefined : noneAppliedId)}
                onclick={() => openEditor('update')}
            >
                <PenLine class="h-4 w-4 mr-1" />
                {m['barcode.update_preset']()}
            </Button>
            <Button variant="outline" size="sm" onclick={() => (dialog = 'manage')}>
                <Settings class="h-4 w-4 mr-1" />
                {m['barcode.manage']()}
            </Button>
        </div>
    </div>

    {#if options.layoutPrintable && !selected}
        <p id={noneAppliedId} class="text-xs text-muted-foreground">
            {m['barcode.preset_to_update_missing']()}
        </p>
    {/if}
    {#if !options.layoutPrintable}
        <!-- The server refuses such a preset. Said here, by the buttons: on a phone, the list
             under the form is a screen away. -->
        <div id={reasonId} class="text-xs text-destructive">
            <p>{m['barcode.preset_not_printable']()}</p>
            <ul>
                {#each options.layoutErrors as issue (issue.code)}
                    <li>• {labelIssueMessage(issue)}</li>
                {/each}
            </ul>
        </div>
    {/if}

    {#if presets.length > 0}
        <div class="space-y-2">
            <Label for="preset-select">{m['barcode.apply_preset']()}</Label>
            <OptionSelect
                id="preset-select"
                value={selectedId}
                placeholder={m['barcode.select_preset']()}
                options={presets.map((preset) => ({
                    value: preset.id,
                    label: presetLabel(preset)
                }))}
                onValueChange={(id) => {
                    const preset = presets.find((each) => each.id === id);
                    if (preset) apply(preset);
                }}
            />
        </div>
    {/if}
</div>

<Dialog
    open={dialog === 'save' || dialog === 'update'}
    onOpenChange={(open) => !open && (dialog = null)}
>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>
                {dialog === 'update'
                    ? m['barcode.update_preset']()
                    : m['barcode.save_as_new_preset']()}
            </DialogTitle>
        </DialogHeader>
        <form
            class="space-y-4"
            onsubmit={(event) => {
                event.preventDefault();
                savePreset();
            }}
        >
            <div class="space-y-2">
                <Label for="preset-name">{m['barcode.preset_name']()}</Label>
                <Input
                    id="preset-name"
                    bind:value={name}
                    placeholder={m['barcode.preset_name_placeholder']()}
                    aria-describedby={name.trim() ? undefined : nameMissingId}
                />
                {#if !name.trim()}
                    <p id={nameMissingId} class="text-xs text-muted-foreground">
                        {m['barcode.preset_name_missing']()}
                    </p>
                {/if}
            </div>
            <div class="space-y-2">
                <Label for="preset-description">{m['barcode.description_optional']()}</Label>
                <Input
                    id="preset-description"
                    bind:value={description}
                    placeholder={m['barcode.description_placeholder']()}
                />
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" onclick={() => (dialog = null)}>
                    {m['common.cancel']()}
                </Button>
                <Button type="submit" disabled={!name.trim()}>
                    {dialog === 'update'
                        ? m['barcode.update_preset']()
                        : m['barcode.save_new_preset']()}
                </Button>
            </div>
        </form>
    </DialogContent>
</Dialog>

<Dialog open={dialog === 'manage'} onOpenChange={(open) => !open && (dialog = null)}>
    <ScrollingDialogContent title={m['barcode.manage_label_presets']()} class="max-w-2xl">
        <div class="space-y-2">
            {#each presets as preset (preset.id)}
                <div class="flex items-center justify-between gap-2 p-3 border rounded-lg">
                    <div class="min-w-0">
                        <h3 class="font-medium">{preset.name}</h3>
                        {#if preset.description}
                            <p class="text-sm text-muted-foreground">{preset.description}</p>
                        {/if}
                        <p class="text-xs text-muted-foreground mt-1">
                            {m['barcode.preset_summary']({
                                format: preset.pageFormat,
                                width: preset.labelWidth,
                                height: preset.labelHeight,
                                code:
                                    preset.codeType === 'qrcode'
                                        ? m['barcode.qr_code']()
                                        : m['common.barcode']()
                            })}
                        </p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => {
                                apply(preset);
                                dialog = null;
                            }}
                        >
                            {m['barcode.apply']()}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            aria-label={m['common.delete']()}
                            title={m['common.delete']()}
                            onclick={() => deletePreset(preset)}
                        >
                            <Trash class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            {:else}
                <p class="text-center py-6 text-muted-foreground">{m['barcode.no_presets']()}</p>
            {/each}
        </div>
    </ScrollingDialogContent>
</Dialog>
