<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { Settings } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { errorMessage, request } from '#lib/api/client.js';

    let { open = $bindable(false), hours }: { open: boolean; hours: number } = $props();

    let newHours = $state(24);
    let error = $state('');
    let saving = $state(false);

    $effect(() => {
        if (!open) return;
        newHours = hours;
        error = '';
    });

    // The server checks the range (1 to 168 hours) and says what is wrong.
    async function save() {
        error = '';
        saving = true;
        try {
            await request('/api/settings', {
                method: 'PUT',
                json: { sessionTimeoutHours: newHours }
            });
            toasts.add(m['toast.session_timeout_updated']({ hours: newHours }), 'success');
            open = false;
            await invalidateAll();
        } catch (failure) {
            error = errorMessage(failure);
        } finally {
            saving = false;
        }
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['admin.session_timeout_dialog']()}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                >
                    <Settings class="h-5 w-5 text-primary" />
                </div>
                <div class="flex-1">
                    <p class="text-sm text-muted-foreground mb-4">
                        {m['admin.session_timeout_description']()}
                    </p>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label for="session-timeout">{m['admin.timeout_hours']()}</Label>
                            <Input
                                id="session-timeout"
                                type="number"
                                bind:value={newHours}
                                min="1"
                                max="168"
                                placeholder={m['placeholders.session_timeout_example']()}
                                class="w-full"
                            />
                            <p class="text-xs text-muted-foreground">
                                {m['admin.session_timeout_value']({ hours })}
                            </p>
                        </div>
                        {#if error}
                            <p class="text-sm text-destructive">{error}</p>
                        {/if}
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="outline" onclick={() => (open = false)}>
                    {m['common.cancel']()}
                </Button>
                <Button onclick={save} disabled={saving || !newHours}>
                    {m['common.save']()}
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
