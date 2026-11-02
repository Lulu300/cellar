<script lang="ts">
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';

    /**
     * Cancel and Confirm of a bottle dialog, both disabled while its change is on its way, and
     * Confirm while the dialog says why the change cannot go (`refused`).
     */
    let {
        sending,
        refused = false,
        onCancel,
        onConfirm
    }: {
        sending: boolean;
        refused?: boolean;
        onCancel: () => void;
        onConfirm: () => void;
    } = $props();
</script>

<div class="flex justify-end gap-2">
    <Button variant="outline" onclick={onCancel} disabled={sending}>
        {m['common.cancel']()}
    </Button>
    <Button onclick={onConfirm} disabled={sending || refused}>
        {#if sending}
            {m['common.updating']()}
        {:else}
            {m['common.confirm']()}
        {/if}
    </Button>
</div>
