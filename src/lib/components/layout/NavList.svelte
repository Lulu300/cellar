<script lang="ts">
    import NavRow from './NavRow.svelte';
    import type { NavSection } from './navigation.js';

    /** The sections one under the other, each under its name, as the phone menus show them. */
    let { sections, onchoose }: { sections: NavSection[]; onchoose?: () => void } = $props();

    const listId = $props.id();
</script>

<ul class="flex flex-col gap-0.5">
    {#each sections as section, index (section.label)}
        {#if section.direct}
            <!-- Set apart like a section, so that it does not read as a page of the one above -->
            <li class="pt-3"><NavRow item={section.items[0]} {onchoose} /></li>
        {:else}
            <li>
                <span
                    id="{listId}-{index}"
                    class="block px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                    {section.label}
                </span>
                <ul aria-labelledby="{listId}-{index}" class="flex flex-col gap-0.5">
                    {#each section.items as item (item.label)}
                        <li><NavRow {item} {onchoose} /></li>
                    {/each}
                </ul>
            </li>
        {/if}
    {/each}
</ul>
