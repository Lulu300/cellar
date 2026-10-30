<script lang="ts">
    import { Search, X } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Input } from '#lib/components/ui/input/index.js';

    let {
        value,
        placeholder,
        onSearch
    }: { value: string; placeholder: string; onSearch: (query: string) => void } = $props();
</script>

<div class="relative">
    <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
        {value}
        {placeholder}
        aria-label={placeholder}
        class="pl-8 pr-8"
        oninput={(event) => onSearch(event.currentTarget.value)}
    />
    {#if value}
        <button
            type="button"
            onclick={() => onSearch('')}
            aria-label={m['admin.clear_search']()}
            class="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
        >
            <X class="h-4 w-4" />
        </button>
    {/if}
</div>
