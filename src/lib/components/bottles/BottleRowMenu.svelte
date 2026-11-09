<script
    lang="ts"
    generics="B extends {
        id: string;
        vintage: number | null;
        definition?: { name: string } | null;
    }"
>
    import {
        ArrowRightLeft,
        CalendarClock,
        EllipsisVertical,
        SquarePen,
        Wine
    } from '@lucide/svelte';
    import { iconButton } from '#lib/components/layout/button-states.js';
    import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { cn } from '#lib/utils.js';
    import { bottleName } from './bottle-table.js';
    import { whenLoggedIn, type BottleDialogs } from './bottle-dialogs.svelte.js';

    /**
     * The « ⋯ » menu of a bottle in a list of several wines: mark it drunk, move it, give it a
     * drinking window, or edit it. A visitor is asked to log in.
     */
    let {
        bottle,
        dialogs,
        onEdit
    }: {
        bottle: B;
        dialogs: BottleDialogs<B>;
        onEdit: (bottle: B) => void;
    } = $props();

    const name = $derived(m['bottles.actions_for']({ name: bottleName(bottle) }));
</script>

<DropdownMenu.Root>
    <DropdownMenu.Trigger class={cn(iconButton, 'size-8')} title={name} aria-label={name}>
        <EllipsisVertical class="h-4 w-4" aria-hidden="true" />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-auto outline-none">
        <DropdownMenu.Item onSelect={() => whenLoggedIn(() => (dialogs.status = [bottle]))}>
            <Wine aria-hidden="true" />
            {m['bottles.mark_drunk']()}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => whenLoggedIn(() => (dialogs.moving = [bottle]))}>
            <ArrowRightLeft aria-hidden="true" />
            {m['bottles.move']()}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => whenLoggedIn(() => (dialogs.dating = [bottle]))}>
            <CalendarClock aria-hidden="true" />
            {m['drinking.window']()}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => whenLoggedIn(() => onEdit(bottle))}>
            <SquarePen aria-hidden="true" />
            {m['forms.edit_wine_bottle']()}
        </DropdownMenu.Item>
    </DropdownMenu.Content>
</DropdownMenu.Root>
