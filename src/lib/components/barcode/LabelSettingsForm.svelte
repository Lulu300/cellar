<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import NumberInput from '#lib/components/forms/NumberInput.svelte';
    import * as Select from '#lib/components/ui/select/index.js';
    import { PAGE_FORMATS, type PageFormat } from '#lib/shared/labels.js';
    import type { LabelOptions } from './label-options.svelte.js';

    /** The fields of the label PDF: the range of codes and the layout. */
    let { options }: { options: LabelOptions } = $props();
    // What each field expects, under it, when the server would refuse it
    const fieldErrors = $derived(options.fieldErrors);

    function pageFormatName(format: PageFormat): string {
        if (format === 'Letter') return m['barcode.paper_letter']();
        if (format === 'Legal') return m['barcode.paper_legal']();
        return format;
    }

    /** The fields of the advanced settings, in mm. */
    const advancedFields = $derived([
        { key: 'marginTop', label: m['barcode.top_margin']() },
        { key: 'marginLeft', label: m['barcode.left_margin']() },
        { key: 'marginBottom', label: m['barcode.bottom_margin']() },
        { key: 'marginRight', label: m['barcode.right_margin']() },
        { key: 'horizontalSpacing', label: m['barcode.horizontal_spacing']() },
        { key: 'verticalSpacing', label: m['barcode.vertical_spacing']() },
        { key: 'labelPadding', label: m['barcode.label_padding']() }
    ] as const);

    // Kept open while one of its fields is invalid, so that the message of that field shows.
    let advancedOpen = $state(false);
    const advancedInvalid = $derived(advancedFields.some(({ key }) => fieldErrors[key]));
    $effect(() => {
        if (advancedInvalid && !advancedOpen) advancedOpen = true;
    });
</script>

<div class="grid grid-cols-2 gap-3">
    <FormField
        label={m['barcode.starting_number']()}
        id="pdf-start-number"
        error={fieldErrors.startNumber}
    >
        <Input
            id="pdf-start-number"
            type="number"
            bind:value={options.startNumber}
            min="1"
            class="font-mono text-sm"
        />
    </FormField>

    <FormField label={m['barcode.count']()} id="pdf-count" error={fieldErrors.count}>
        <Input
            id="pdf-count"
            type="number"
            bind:value={options.count}
            min="1"
            max="1000"
            class="text-sm"
        />
    </FormField>
</div>

<div class="space-y-2">
    <Label for="page-format">{m['barcode.page_format']()}</Label>
    <Select.Root type="single" bind:value={options.layout.pageFormat}>
        <Select.Trigger id="page-format" class="w-full h-10"
            >{pageFormatName(options.layout.pageFormat)}</Select.Trigger
        >
        <Select.Content>
            {#each PAGE_FORMATS as format (format)}
                <Select.Item value={format} label={pageFormatName(format)}>
                    {pageFormatName(format)}
                </Select.Item>
            {/each}
        </Select.Content>
    </Select.Root>
</div>

<div class="grid grid-cols-2 gap-3">
    <FormField label={m['barcode.width_mm']()} id="label-width" error={fieldErrors.labelWidth}>
        <NumberInput id="label-width" bind:value={options.layout.labelWidth} class="text-sm" />
    </FormField>

    <FormField label={m['barcode.height_mm']()} id="label-height" error={fieldErrors.labelHeight}>
        <NumberInput id="label-height" bind:value={options.layout.labelHeight} class="text-sm" />
    </FormField>
</div>

<fieldset class="space-y-3">
    <legend class="text-sm leading-none font-medium select-none">{m['barcode.code_type']()}</legend>
    <div class="flex gap-4">
        <label class="flex items-center space-x-2 cursor-pointer">
            <input
                type="radio"
                bind:group={options.layout.codeType}
                value="barcode"
                class="h-4 w-4"
            />
            <span class="text-sm">{m['common.barcode']()}</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer">
            <input
                type="radio"
                bind:group={options.layout.codeType}
                value="qrcode"
                class="h-4 w-4"
            />
            <span class="text-sm">{m['barcode.qr_code']()}</span>
        </label>
    </div>
</fieldset>

<div class="flex items-center space-x-2">
    <input
        type="checkbox"
        bind:checked={options.layout.showCodeValue}
        id="show-code-value"
        class="h-4 w-4 rounded border-input"
    />
    <Label for="show-code-value" class="text-sm">{m['barcode.show_code_value']()}</Label>
</div>
<div class="flex items-center space-x-2">
    <input
        type="checkbox"
        bind:checked={options.layout.showBorder}
        id="show-border"
        class="h-4 w-4 rounded border-input"
    />
    <Label for="show-border" class="text-sm">{m['barcode.show_border']()}</Label>
</div>

<details class="space-y-2" bind:open={advancedOpen}>
    <summary class="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        {m['barcode.advanced_settings']()}
    </summary>
    <div class="grid grid-cols-2 gap-2 pt-2">
        {#each advancedFields as field (field.key)}
            <FormField
                label={field.label}
                id="label-{field.key}"
                error={fieldErrors[field.key]}
                class={field.key === 'labelPadding' ? 'col-span-2' : ''}
                labelClass="text-xs"
            >
                <NumberInput
                    id="label-{field.key}"
                    bind:value={options.layout[field.key]}
                    class="text-xs h-8"
                />
            </FormField>
        {/each}
    </div>
</details>
