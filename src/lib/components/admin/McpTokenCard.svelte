<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { page } from '$app/state';
    import { Bot, Copy } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Checkbox } from '#lib/components/ui/checkbox/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { confirm } from '#lib/components/layout/confirm.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';
    import type { McpTokenDTO, NewTokenDTO } from '#lib/shared/dto.js';

    let { mcpToken }: { mcpToken: McpTokenDTO } = $props();

    const TOKEN_ROUTE = '/api/admin/mcp-token';
    // url.origin honours ORIGIN: the address the assistant reaches Cellar at, as the browser does.
    const mcpUrl = $derived(new URL('/mcp', page.url.origin).href);

    // Shown once, then forgotten: the server keeps only its hash.
    let token = $state('');
    let busy = $state(false);
    let tokenElement = $state<HTMLElement>();
    // Changed at once on a click, and put back if the server refuses it.
    let write = $derived(mcpToken.write);

    async function generate() {
        busy = true;
        try {
            token = (await request<NewTokenDTO>(TOKEN_ROUTE, { method: 'POST' })).token;
            await invalidateAll();
        } catch {
            toasts.add(m['admin.token_failed']());
        } finally {
            busy = false;
        }
    }

    // The clipboard needs a secure context: over plain HTTP on the LAN it is missing, and the token
    // is selected instead, for the user to copy it by hand.
    async function copyToken() {
        try {
            await navigator.clipboard.writeText(token);
            toasts.add(m['admin.token_copied'](), 'success');
        } catch {
            if (tokenElement) getSelection()?.selectAllChildren(tokenElement);
            toasts.add(m['admin.token_selected'](), 'warning');
        }
    }

    async function revoke() {
        if (
            !(await confirm({
                message: m['admin.mcp_revoke_confirm'](),
                confirmLabel: m['admin.mcp_revoke']()
            }))
        ) {
            return;
        }
        busy = true;
        try {
            await request(TOKEN_ROUTE, { method: 'DELETE' });
            token = '';
            toasts.add(m['toast.mcp_token_revoked'](), 'success');
            await invalidateAll();
        } catch (failure) {
            toasts.add(errorMessage(failure));
        } finally {
            busy = false;
        }
    }

    async function saveWrite(allowed: boolean) {
        try {
            await request(TOKEN_ROUTE, { method: 'PUT', json: { write: allowed } });
            toasts.add(m['toast.mcp_access_saved'](), 'success');
            await invalidateAll();
        } catch (failure) {
            write = !allowed;
            toasts.add(errorMessage(failure));
        }
    }
</script>

<Card>
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <Bot class="h-5 w-5" />
            {m['admin.mcp_access']()}
        </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">{m['admin.mcp_description']()}</p>
        <p class="text-sm">
            {write ? m['admin.mcp_allows_write']() : m['admin.mcp_allows_read']()}
        </p>
        <div class="flex items-center gap-2">
            <Checkbox id="mcp-write" bind:checked={write} onCheckedChange={saveWrite} />
            <Label for="mcp-write">{m['admin.mcp_allow_write']()}</Label>
        </div>
        <div class="space-y-1">
            <p class="text-sm">{m['common.label']({ label: m['admin.mcp_address']() })}</p>
            <code class="block select-all break-all rounded bg-muted p-2 text-xs">{mcpUrl}</code>
        </div>
        {#if token}
            <p class="text-sm font-medium">{m['admin.mcp_token_shown_once']()}</p>
            <div class="flex items-start gap-2">
                <code
                    bind:this={tokenElement}
                    class="block flex-1 select-all break-all rounded bg-muted p-2 text-xs"
                    >{token}</code
                >
                <Button variant="outline" size="sm" onclick={copyToken}>
                    <Copy class="h-4 w-4" />
                    {m['admin.copy_token']()}
                </Button>
            </div>
        {:else}
            <p class="text-sm font-medium">
                {mcpToken.hasToken ? m['admin.mcp_token_exists']() : m['admin.mcp_token_missing']()}
            </p>
        {/if}
        <div class="flex flex-wrap gap-2">
            <Button variant="outline" onclick={generate} disabled={busy}>
                {mcpToken.hasToken ? m['admin.regenerate_token']() : m['admin.generate_token']()}
            </Button>
            {#if mcpToken.hasToken}
                <Button variant="outline" onclick={revoke} disabled={busy}>
                    {m['admin.mcp_revoke']()}
                </Button>
            {/if}
        </div>
    </CardContent>
</Card>
