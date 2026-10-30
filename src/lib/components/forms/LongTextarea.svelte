<script lang="ts">
    import type { HTMLTextareaAttributes } from 'svelte/elements';
    import { m } from '#lib/paraglide/messages.js';
    import { Textarea } from '#lib/components/ui/textarea/index.js';
    import { LONG_TEXT_MAX_LENGTH } from '#lib/shared/schemas/common.js';
    import { formatNumber } from '#lib/utils/format.js';

    /**
     * A note or a description: it takes no more characters than the API does, and says how many
     * it holds out of that limit, so that the limit shows before the user reaches it.
     */
    let {
        id,
        value = $bindable(''),
        'aria-describedby': describedBy,
        ...rest
    }: Omit<HTMLTextareaAttributes, 'id' | 'maxlength' | 'value'> & {
        id: string;
        value?: string | null;
    } = $props();
</script>

<Textarea
    {id}
    bind:value
    maxlength={LONG_TEXT_MAX_LENGTH}
    aria-describedby={[describedBy, `${id}-length`].filter(Boolean).join(' ')}
    {...rest}
/>
<p id="{id}-length" class="text-right text-xs text-muted-foreground">
    {m['forms.text_length']({
        count: formatNumber(value?.length ?? 0),
        max: formatNumber(LONG_TEXT_MAX_LENGTH)
    })}
</p>
