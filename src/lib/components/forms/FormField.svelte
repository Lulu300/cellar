<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import { Label } from '#lib/components/ui/label/index.js';

    /** A field of a form: its label, the control, then its error, or else a hint. */
    let {
        label,
        id,
        error,
        hint,
        class: className = '',
        labelClass,
        children
    }: {
        label: string;
        /** The id of the control, which the label names. */
        id?: string;
        error?: string;
        hint?: string;
        class?: string;
        labelClass?: string;
        children: Snippet;
    } = $props();

    const fieldId = $props.id();
    const labelId = `${fieldId}-label`;
    const messageId = `${fieldId}-message`;

    // The control comes from the caller's snippet, which this component cannot pass attributes to:
    // it marks the first field it holds instead. A screen reader then reads the error or the hint
    // with the field, and FormAction finds the first field in error by its aria-invalid. A field
    // without an id (a SearchableSelect) is named by the label this way too. Buttons, file inputs
    // and controls named on their own are left alone: they are actions, such as removing an image
    // or searching the images, not the field.
    const describeControl: Attachment<HTMLElement> = (field) => {
        const mark = () => {
            const control = field.querySelector(
                ':is(input:not([type="hidden"], [type="file"]), textarea, select, [role="combobox"]):not([aria-label])'
            );
            if (!control) return;
            // Keeps what the control is described by already, such as a character counter.
            const others = (control.getAttribute('aria-describedby') ?? '')
                .split(' ')
                .filter((describer) => describer && describer !== messageId);
            const describers = error || hint ? [messageId, ...others] : others;
            if (describers.length) control.setAttribute('aria-describedby', describers.join(' '));
            else control.removeAttribute('aria-describedby');
            if (error) control.setAttribute('aria-invalid', 'true');
            else control.removeAttribute('aria-invalid');
            if (!id) control.setAttribute('aria-labelledby', labelId);
        };
        mark();
        // The control may come later or change, e.g. a SearchableSelect once its options load.
        const observer = new MutationObserver(mark);
        observer.observe(field, { childList: true, subtree: true });
        return () => observer.disconnect();
    };
</script>

<div class="space-y-2 {className}" {@attach describeControl}>
    <Label id={labelId} for={id} class={labelClass}>{label}</Label>
    {@render children()}
    {#if error}
        <p id={messageId} class="text-sm text-destructive">{error}</p>
    {:else if hint}
        <p id={messageId} class="text-xs text-muted-foreground">{hint}</p>
    {/if}
</div>
