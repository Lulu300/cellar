<script lang="ts" generics="T extends string">
    import * as Select from '#lib/components/ui/select/index.js';
    import { cn } from '#lib/utils.js';

    /**
     * One choice among a few fixed options, in the theme's Select. It takes its name from a
     * `<label for={id}>`, or else from `aria-label`. Until an option is chosen, it shows
     * `placeholder`.
     */
    let {
        value = $bindable(),
        options,
        id,
        'aria-label': ariaLabel,
        placeholder = '',
        disabled = false,
        size = 'default',
        class: className,
        onValueChange
    }: {
        value: T;
        options: { value: T; label: string }[];
        id?: string;
        'aria-label'?: string;
        placeholder?: string;
        disabled?: boolean;
        size?: 'sm' | 'default';
        class?: string;
        onValueChange?: (value: T) => void;
    } = $props();

    const chosen = $derived(options.find((option) => option.value === value));

    // `items` lets a typed letter choose an option while the list is closed, as on a native
    // select. bits-ui 2.20 hands that search every key pressed on the closed list, though, Tab
    // included: tabbing past the CSV delimiter chose "Tab" (BUG-23). The search only runs with
    // `items`, and this handler runs before bits-ui's, so `items` are given only for a printable
    // character typed without Ctrl, Alt or Meta.
    let printableKey = $state(false);

    function checkKey(event: KeyboardEvent) {
        printableKey = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;
    }
</script>

<!-- The items only offer `options`, so the value that bits-ui hands back is always a T.
     Its text, placeholder included (bits-ui marks an empty value, "All" or nothing chosen yet, as
     one), keeps the text colour of a native select: a muted grey, inherited or not, falls under
     4.5:1 on a dark field. -->
<Select.Root
    type="single"
    bind:value={() => value, (next) => (value = next as T)}
    items={printableKey ? options : []}
    {disabled}
    onValueChange={(next) => onValueChange?.(next as T)}
>
    <Select.Trigger
        {id}
        aria-label={ariaLabel}
        {size}
        onkeydown={checkKey}
        class={cn('w-full min-w-0 text-foreground data-[placeholder]:text-foreground', className)}
    >
        <span class="truncate">{chosen?.label ?? placeholder}</span>
    </Select.Trigger>
    <Select.Content>
        {#each options as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
        {/each}
    </Select.Content>
</Select.Root>
