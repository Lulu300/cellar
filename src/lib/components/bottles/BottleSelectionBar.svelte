<script lang="ts">
    import type { CalendarClock } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { whenLoggedIn } from './bottle-dialogs.svelte.js';

    /**
     * The bar of a list whose bottles are ticked: how many, « Effacer la sélection », and what the
     * list does with them. A visitor sees the same bar; an action opens the login dialog instead.
     */
    let {
        selection,
        actions
    }: {
        selection: { readonly size: number; clear(): void };
        /** In their order; `primary` is the list's main action, filled. */
        actions: {
            label: string;
            /** A Lucide icon, such as CalendarClock */
            icon?: typeof CalendarClock;
            primary?: boolean;
            run: () => void;
        }[];
    } = $props();
</script>

<!-- Wrapping: the actions stay in view on a narrow screen. While nothing is ticked, only the count
     stays, unseen and taking no room: a live region in the page from the start is read out at each
     change, the first tick and the clearing included. -->
<div class={selection.size > 0 ? 'flex flex-wrap items-center gap-2' : 'contents'}>
    <span
        class={selection.size > 0 ? 'text-sm font-medium text-primary-text' : 'sr-only'}
        role="status"
    >
        {m['common.bottles_selected']({ count: selection.size })}
    </span>
    {#if selection.size > 0}
        <Button variant="ghost" size="sm" onclick={() => selection.clear()}>
            {m['common.clear_selection']()}
        </Button>
        <div class="flex flex-wrap gap-2 sm:ml-auto">
            {#each actions as { label, icon: Icon, primary, run } (label)}
                <Button
                    variant={primary ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => whenLoggedIn(run)}
                >
                    {#if Icon}
                        <Icon class="h-4 w-4" aria-hidden="true" />
                    {/if}
                    {label}
                </Button>
            {/each}
        </div>
    {/if}
</div>
