<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import LongTextarea from '#lib/components/forms/LongTextarea.svelte';
    import { Label } from '#lib/components/ui/label/index.js';
    import LocaleDateInput from '#lib/components/forms/LocaleDateInput.svelte';

    /**
     * The date and the note of a consumption. The screens propose today's date; an empty one saves
     * the consumption without a date.
     */
    let {
        date = $bindable(''),
        note = $bindable(''),
        disabled = false,
        class: className = 'space-y-4'
    }: { date?: string; note?: string; disabled?: boolean; class?: string } = $props();

    const id = $props.id();
</script>

<div class={className}>
    <div class="space-y-2">
        <Label for="{id}-date">{m['common.consumed_date']()}</Label>
        <LocaleDateInput id="{id}-date" bind:value={date} {disabled} />
    </div>
    <div class="space-y-2">
        <Label for="{id}-note">{m['bottles.notes_optional']()}</Label>
        <LongTextarea
            id="{id}-note"
            bind:value={note}
            placeholder={m['admin.add_wine_thoughts_placeholder']()}
            class="w-full min-h-[80px]"
            {disabled}
            aria-describedby="{id}-hint"
        />
        <p id="{id}-hint" class="text-xs text-muted-foreground">
            {m['availability.consumed_note_hint']()}
        </p>
    </div>
</div>
