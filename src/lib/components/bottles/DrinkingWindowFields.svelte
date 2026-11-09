<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import YearMonthFields from './YearMonthFields.svelte';

    /**
     * A drinking window: « à partir de » and « avant fin », each a year or a month of a year, either
     * one or both, as YYYY or YYYY-MM, empty for none.
     */
    let {
        drinkFrom = $bindable(),
        drinkBefore = $bindable(),
        disabled = false
    }: { drinkFrom: string; drinkBefore: string; disabled?: boolean } = $props();
</script>

<div class="space-y-3">
    <YearMonthFields bind:value={drinkFrom} legend={m['drinking.from']()} start {disabled} />
    <YearMonthFields bind:value={drinkBefore} legend={m['drinking.before_end']()} {disabled} />
</div>
