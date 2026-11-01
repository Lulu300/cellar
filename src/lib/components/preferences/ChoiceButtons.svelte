<script lang="ts" generics="Value extends string | boolean">
    import type { HTMLAttributes } from 'svelte/elements';
    import { Button } from '#lib/components/ui/button/index.js';
    import { cn } from '#lib/utils.js';
    import { moveChoice } from './radio-group.js';

    /**
     * A few choices, as buttons that work as radios and tell which one is on. The group takes its
     * name from the attributes given (`aria-label`, `aria-labelledby`).
     */
    let {
        options,
        value,
        onchange,
        chooseWithArrows = true,
        class: className = '',
        buttonClass = '',
        ...rest
    }: {
        options: { value: Value; label: string }[];
        value: Value;
        onchange: (value: Value) => void;
        /** False when a choice reloads the page: the arrows then only move between choices. */
        chooseWithArrows?: boolean;
        buttonClass?: string;
    } & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onchange'> = $props();
</script>

<div {...rest} role="radiogroup" class={cn('flex gap-1 border rounded-md p-1', className)}>
    {#each options as option (option.value)}
        {@const checked = option.value === value}
        <Button
            role="radio"
            aria-checked={checked}
            tabindex={checked ? 0 : -1}
            variant={checked ? 'default' : 'ghost'}
            size="sm"
            class={cn('text-xs', buttonClass)}
            onclick={() => onchange(option.value)}
            onkeydown={(event) => moveChoice(event, chooseWithArrows)}
        >
            {option.label}
        </Button>
    {/each}
</div>
