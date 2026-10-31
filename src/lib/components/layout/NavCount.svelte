<script lang="ts">
    import type { NavItem } from './navigation.js';

    /**
     * The number of a menu entry: grey after its name, or a red pill for an alert, or a red badge
     * on the corner of the button around it. Screen readers hear its label instead.
     */
    let { count, badge = false }: { count: NonNullable<NavItem['count']>; badge?: boolean } =
        $props();
</script>

{#if count.value > 0}
    <!-- A fixed dark red with white text keeps the count readable in every theme -->
    <span
        class={badge
            ? 'pointer-events-none absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-red-700 px-1.5 text-xs font-bold text-white shadow-lg'
            : count.alert
              ? 'ml-auto rounded-full bg-red-700 px-1.5 text-xs leading-[18px] font-semibold text-white tabular-nums'
              : 'ml-auto text-xs font-semibold text-muted-foreground tabular-nums'}
    >
        <span aria-hidden="true">{count.value}</span>
        <span class="sr-only">{count.label}</span>
    </span>
{/if}
