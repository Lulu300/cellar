<script lang="ts">
    import * as Select from '#lib/components/ui/select/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { PAGE_SIZES } from '#lib/shared/schemas/bottle-list.js';
    import { showTablePage } from '#lib/utils/table-navigation.js';

    /** How many bottles a page of the table shows, read from and written to the URL. */
    let { perPage }: { perPage: number } = $props();

    const id = $props.id();
</script>

<div class="flex items-center gap-2">
    <label for={id} class="text-sm text-muted-foreground">{m['pagination.per_page']()}</label>
    <Select.Root
        type="single"
        value={String(perPage)}
        onValueChange={(size) => showTablePage({ perPage: size, page: null })}
    >
        <Select.Trigger {id} class="w-20 h-9">{perPage}</Select.Trigger>
        <Select.Content>
            {#each PAGE_SIZES as size (size)}
                <Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>
            {/each}
        </Select.Content>
    </Select.Root>
</div>
