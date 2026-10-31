<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { Key } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { MIN_ACCESS_CODE_LENGTH } from '#lib/utils/access-code.js';

    let { open = $bindable(false) }: { open: boolean } = $props();

    let currentAccessCode = $state('');
    let newAccessCode = $state('');
    let confirmAccessCode = $state('');
    let accessCodeError = $state('');
    // Greyed while the change runs, so that a double click sends it once.
    let changing = $state(false);
    // The button is greyed until the three fields hold something: a line by it says why.
    const fieldsMissing = $derived(
        !currentAccessCode.trim() || !newAccessCode.trim() || !confirmAccessCode.trim()
    );

    function closeDialog() {
        open = false;
        newAccessCode = '';
        confirmAccessCode = '';
        currentAccessCode = '';
        accessCodeError = '';
    }

    async function changeAccessCode() {
        if (changing) return;
        accessCodeError = '';
        // Trimmed like the code typed at login, which must match the new one.
        const currentCode = currentAccessCode.trim();
        const newCode = newAccessCode.trim();

        if (newCode.length < MIN_ACCESS_CODE_LENGTH) {
            accessCodeError = m['auth.access_code_too_short']({ min: MIN_ACCESS_CODE_LENGTH });
            return;
        }

        if (newCode !== confirmAccessCode.trim()) {
            accessCodeError = m['admin.access_code_mismatch']();
            return;
        }

        changing = true;
        const result = await auth.changeAccessCode(currentCode, newCode);
        changing = false;

        if (result.success) {
            toasts.add(m['toast.access_code_changed'](), 'success');
            closeDialog();
        } else if (result.retryAfter) {
            accessCodeError = m['auth.too_many_attempts']({ seconds: result.retryAfter });
        } else if (result.status === 403 || result.status === 422) {
            // 403: wrong current code. 422: only a current code over the length limit gets past
            // the checks above, and it cannot be right either.
            accessCodeError = m['auth.invalid_access_code']();
        } else {
            accessCodeError = m['admin.error_saving']();
        }
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['admin.change_access_code']()}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="flex items-start gap-3">
                <div
                    class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                >
                    <Key class="h-5 w-5 text-primary" />
                </div>
                <div class="flex-1">
                    <p class="text-sm text-muted-foreground mb-4">
                        {m['admin.access_code_change_description']()}
                    </p>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label for="current-access-code"
                                >{m['admin.current_access_code']()}</Label
                            >
                            <Input
                                id="current-access-code"
                                type="password"
                                bind:value={currentAccessCode}
                                placeholder={m['placeholders.enter_current_access_code']()}
                                class="w-full"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="new-access-code">{m['auth.new_access_code']()}</Label>
                            <Input
                                id="new-access-code"
                                type="password"
                                bind:value={newAccessCode}
                                placeholder={m['placeholders.enter_new_access_code']()}
                                class="w-full"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="confirm-access-code"
                                >{m['auth.confirm_access_code']()}</Label
                            >
                            <Input
                                id="confirm-access-code"
                                type="password"
                                bind:value={confirmAccessCode}
                                placeholder={m['placeholders.confirm_new_access_code']()}
                                class="w-full"
                            />
                        </div>
                        {#if accessCodeError}
                            <p class="text-sm text-destructive">{accessCodeError}</p>
                        {/if}
                        {#if fieldsMissing}
                            <p
                                id="access-code-fields-missing"
                                class="text-xs text-muted-foreground"
                            >
                                {m['admin.access_code_fields_missing']()}
                            </p>
                        {/if}
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="outline" onclick={closeDialog}>
                    {m['common.cancel']()}
                </Button>
                <Button
                    onclick={changeAccessCode}
                    disabled={fieldsMissing || changing}
                    aria-describedby={fieldsMissing ? 'access-code-fields-missing' : undefined}
                >
                    {changing ? m['common.updating']() : m['admin.change_access_code']()}
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
