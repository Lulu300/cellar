<script lang="ts">
    import { ChevronDown } from '@lucide/svelte';
    import { page } from '$app/state';
    import NavCount from './NavCount.svelte';
    import NavRow from './NavRow.svelte';
    import { alertOf, isInSection, type NavItem, type NavSection } from './navigation.js';

    /**
     * A section of the top bar. Its name links to its first page, which a tap on a touch screen
     * opens; hovering it or reaching it with the keyboard shows its pages. A direct section is the
     * link alone. With an icon, the name is a button that shows the pages, as the gear does.
     */
    let {
        section,
        icon,
        align = 'start'
    }: { section: NavSection; icon?: NavItem['icon']; align?: 'start' | 'end' } = $props();

    const menuId = $props.id();
    let root = $state<HTMLElement>();
    let trigger = $state<HTMLElement>();
    let open = $state(false);
    // After Escape or a click, the menu stays closed while the pointer or the focus is still on
    // it, rather than opening again at once.
    let held = $state(false);
    // Whether the menu was open before a press on the gear: the focus that the press gives opens
    // it before the click comes.
    let openBeforePress = false;

    const current = $derived(isInSection(page.url.pathname, section));
    const alert = $derived(alertOf([section]));

    function show() {
        if (!held) open = true;
    }

    function hide() {
        open = false;
        held = false;
    }

    function close() {
        open = false;
        held = true;
    }

    function onkeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || !open) return;
        close();
        trigger?.focus();
    }

    // A tap toggles the gear's menu, which a finger cannot hover; a mouse or a key only opens it.
    function onGearClick(event: MouseEvent) {
        if ((event as PointerEvent).pointerType === 'touch' && openBeforePress) return close();
        held = false;
        open = true;
    }

    function onfocusout(event: FocusEvent) {
        if (!root?.contains(event.relatedTarget as Node | null)) hide();
    }

    const triggerClasses = $derived(
        `relative inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm font-medium whitespace-nowrap hover:bg-accent hover:text-accent-foreground ${
            current ? 'bg-accent text-accent-foreground' : ''
        }`
    );
</script>

{#if section.direct}
    <a
        href={section.items[0].href}
        class={triggerClasses}
        aria-current={current ? 'page' : undefined}
    >
        {section.label}
    </a>
{:else}
    <div
        bind:this={root}
        class="relative"
        role="presentation"
        onpointerenter={(event) => event.pointerType !== 'touch' && show()}
        onpointerleave={(event) => event.pointerType !== 'touch' && hide()}
        onfocusin={show}
        {onfocusout}
        {onkeydown}
    >
        {#if icon}
            {@const Icon = icon}
            <button
                bind:this={trigger}
                type="button"
                class="{triggerClasses} w-9 justify-center px-0"
                aria-label={section.label}
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onpointerdown={() => (openBeforePress = open)}
                onclick={onGearClick}
            >
                <Icon class="h-5 w-5" aria-hidden="true" />
            </button>
        {:else}
            <a
                bind:this={trigger}
                href={section.items[0].href}
                class={triggerClasses}
                aria-current={current ? 'true' : undefined}
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onclick={close}
            >
                {section.label}
                <ChevronDown class="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                {#if alert}<NavCount count={alert} badge />{/if}
            </a>
        {/if}

        {#if open}
            <!-- The padding bridges the gap to the name, so that the pointer can cross it -->
            <div
                id={menuId}
                class="absolute top-full z-40 pt-1.5 {align === 'end' ? 'right-0' : 'left-0'}"
            >
                <ul
                    class="flex min-w-52 flex-col rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                    {#each section.items as item (item.label)}
                        <li><NavRow {item} onchoose={close} /></li>
                    {/each}
                </ul>
            </div>
        {/if}
    </div>
{/if}
