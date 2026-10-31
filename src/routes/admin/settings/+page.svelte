<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Clock, Key, Package } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import McpTokenCard from '#lib/components/admin/McpTokenCard.svelte';
    import AccessCodeDialog from '#lib/components/admin/dialogs/AccessCodeDialog.svelte';
    import BarcodeInfoDialog from '#lib/components/admin/dialogs/BarcodeInfoDialog.svelte';
    import BarcodeSettingsDialog from '#lib/components/admin/dialogs/BarcodeSettingsDialog.svelte';
    import SessionTimeoutDialog from '#lib/components/admin/dialogs/SessionTimeoutDialog.svelte';
    import type { BarcodeConflictDTO } from '#lib/shared/dto.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    let showSessionTimeout = $state(false);
    let showBarcodeSettings = $state(false);
    let showAccessCode = $state(false);
    let barcodeConflict = $state<BarcodeConflictDTO | null>(null);
    let showBarcodeConflict = $state(false);
    const barcodes = $derived(data.barcodeSettings);
</script>

<svelte:head>
    <title>{pageTitle(m['admin.section_settings'](), m['admin.title']())}</title>
</svelte:head>

<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Clock class="h-5 w-5" />
                {m['admin.session_timeout']()}
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <p class="text-sm text-muted-foreground">{m['admin.session_timeout_description']()}</p>
            <p class="font-medium">
                {m['admin.session_timeout_value']({ hours: data.settings.sessionTimeoutHours })}
            </p>
            <Button variant="outline" onclick={() => (showSessionTimeout = true)}>
                {m['admin.change_session_timeout']()}
            </Button>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Package class="h-5 w-5" />
                {m['admin.barcode_settings']()}
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <p class="text-sm text-muted-foreground">{m['admin.barcode_description']()}</p>
            <p class="font-medium">
                {#if barcodes.autoGeneration}
                    {m['admin.barcodes_automatic']({
                        prefix: barcodes.prefix || '—',
                        start: barcodes.startNumber
                    })}
                {:else}
                    {m['admin.barcodes_manual']()}
                {/if}
            </p>
            <Button variant="outline" onclick={() => (showBarcodeSettings = true)}>
                {m['admin.change_barcode_settings']()}
            </Button>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Key class="h-5 w-5" />
                {m['admin.change_access_code']()}
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <p class="text-sm text-muted-foreground">{m['admin.access_code_description']()}</p>
            <Button variant="outline" onclick={() => (showAccessCode = true)}>
                {m['admin.change_access_code']()}
            </Button>
        </CardContent>
    </Card>

    <McpTokenCard mcpToken={data.mcpToken} />
</div>

<SessionTimeoutDialog bind:open={showSessionTimeout} hours={data.settings.sessionTimeoutHours} />
<BarcodeSettingsDialog
    bind:open={showBarcodeSettings}
    settings={data.barcodeSettings}
    onConflictInfo={(conflict) => {
        barcodeConflict = conflict;
        showBarcodeConflict = true;
    }}
/>
<BarcodeInfoDialog bind:open={showBarcodeConflict} barcodeInfoData={barcodeConflict} />
<AccessCodeDialog bind:open={showAccessCode} />
