<script lang="ts">
    import { CircleAlert, CircleCheckBig, X } from '@lucide/svelte';
    import { fly } from 'svelte/transition';
    import { m } from '#lib/paraglide/messages.js';

    let {
        message,
        type = 'error',
        onClose
    }: {
        message: string;
        type?: 'success' | 'error' | 'warning';
        onClose: () => void;
    } = $props();

    let visible = $state(true);

    function close() {
        visible = false;
        onClose();
    }

    // A toast floats over the page, so it keeps an opaque card background and
    // shows its type through the border and the icon.
    const typeStyles = {
        success: { border: 'border-success/30', icon: 'text-success' },
        error: { border: 'border-destructive/30', icon: 'text-destructive' },
        warning: { border: 'border-warning/30', icon: 'text-warning' }
    };

    const icons = {
        success: CircleCheckBig,
        error: CircleAlert,
        warning: CircleAlert
    };
    const Icon = $derived(icons[type]);
</script>

{#if visible}
    <div
        class="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card text-card-foreground shadow-lg max-w-sm {typeStyles[
            type
        ].border}"
        transition:fly={{ x: 300, duration: 300 }}
        role="alert"
    >
        <Icon class="h-5 w-5 flex-shrink-0 {typeStyles[type].icon}" />
        <p class="text-sm font-medium flex-1">{message}</p>
        <button
            onclick={close}
            class="flex-shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
            aria-label={m['common.close_notification']()}
        >
            <X class="h-4 w-4" />
        </button>
    </div>
{/if}
