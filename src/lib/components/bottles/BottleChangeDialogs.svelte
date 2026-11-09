<script
    lang="ts"
    generics="B extends {
        id: string;
        availability: string;
        drinkFrom: string | null;
        drinkBefore: string | null;
        optimum: number | null;
        storageCase?: { id: string } | null;
    }"
>
    import type { Snippet } from 'svelte';
    import type { BottleDialogs } from './bottle-dialogs.svelte.js';
    import BottleStatusDialog from './BottleStatusDialog.svelte';
    import DrinkingWindowDialog from './DrinkingWindowDialog.svelte';
    import MoveBottlesDialog from './MoveBottlesDialog.svelte';

    /**
     * The status, move and drinking window dialogs of a list of bottles, open while `dialogs`
     * holds bottles.
     */
    let {
        dialogs,
        children
    }: {
        dialogs: BottleDialogs<B>;
        /** What the status and drinking window dialogs show of their bottles above the choices. */
        children?: Snippet<[B[]]>;
    } = $props();
</script>

{#if dialogs.status.length > 0}
    <BottleStatusDialog
        bottles={dialogs.status}
        onClose={() => (dialogs.status = [])}
        onSaved={dialogs.saved}
        onMissing={dialogs.missing}
    >
        {@render children?.(dialogs.status)}
    </BottleStatusDialog>
{/if}

{#if dialogs.moving.length > 0}
    <MoveBottlesDialog
        bottles={dialogs.moving}
        onClose={() => (dialogs.moving = [])}
        onSaved={dialogs.saved}
        onMissing={dialogs.missing}
    />
{/if}

{#if dialogs.dating.length > 0}
    <DrinkingWindowDialog
        bottles={dialogs.dating}
        onClose={() => (dialogs.dating = [])}
        onSaved={dialogs.saved}
        onMissing={dialogs.missing}
    >
        {@render children?.(dialogs.dating)}
    </DrinkingWindowDialog>
{/if}
