<script lang="ts">
    import { tick } from 'svelte';
    import { BellOff } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { removeTargetQuantity } from './target-quantity.js';

    /**
     * The button that removes the target quantity of a wine, on the shortage tab and its page.
     * The button goes with the target: `onRemoved` gives the keyboard focus a place to land.
     */
    let {
        wine,
        size = 'default',
        class: className = '',
        onRemoved
    }: {
        wine: { id: string; name: string };
        size?: 'default' | 'sm';
        class?: string;
        onRemoved: () => void;
    } = $props();

    let busy = $state(false);
    let button = $state<HTMLElement | null>(null);

    async function remove() {
        // Read now: the page drops this button once the target is gone.
        const removed = onRemoved;
        busy = true;
        const done = await removeTargetQuantity(wine);
        busy = false;
        if (done) {
            removed();
        } else {
            // The browser took the focus away from the button while it was disabled.
            await tick();
            button?.focus();
        }
    }
</script>

<Button
    bind:ref={button}
    variant="outline"
    {size}
    class={className}
    disabled={busy}
    aria-label={m['common.remove_target_named']({ name: wine.name })}
    onclick={remove}
>
    <BellOff class="h-4 w-4" aria-hidden="true" />
    {m['common.remove_target']()}
</Button>
