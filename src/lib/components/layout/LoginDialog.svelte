<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { Lock } from '@lucide/svelte';
    import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogClose,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { m } from '#lib/paraglide/messages.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { MIN_ACCESS_CODE_LENGTH } from '#lib/utils/access-code.js';

    let {
        oncancel
    }: {
        /** Called when the user closes the dialog without logging in. */
        oncancel: () => void;
    } = $props();

    let open = $state(false);
    let loginCode = $state('');
    let confirmCode = $state('');
    let setupToken = $state('');
    let loginError = $state('');
    let isLoggingIn = $state(false);
    // On first launch the same dialog asks for the code to set instead of the current one.
    const isChoosingCode = $derived(!auth.accessCodeSet);
    // The button is greyed without a code: the field says why before any click.
    const codeMissing = $derived(!loginCode.trim());

    /** Opens the dialog, with a notice such as why the session ended. */
    export function show(notice = '') {
        loginCode = '';
        confirmCode = '';
        setupToken = '';
        loginError = notice;
        open = true;
    }

    // Escape, the close button and Cancel all close the dialog through here, not a login.
    function handleOpenChange(isOpen: boolean) {
        if (!isOpen && !auth.isAuthenticated) oncancel();
    }

    async function handleLogin() {
        isLoggingIn = true;
        loginError = '';

        try {
            const { valid, retryAfter, restoring } = await auth.authenticate(loginCode.trim());

            if (valid) {
                completeLogin(m['auth.successfully_logged_in']());
            } else if (restoring) {
                // Not a wrong code: the same one works once the restore ends.
                loginError = m['auth.restore_in_progress']();
            } else {
                loginError = retryAfter
                    ? m['auth.too_many_attempts']({ seconds: retryAfter })
                    : m['auth.invalid_access_code']();
                loginCode = '';
            }
        } catch {
            loginError = m['auth.login_error_occurred']();
            loginCode = '';
        } finally {
            isLoggingIn = false;
        }
    }

    async function handleChooseCode() {
        // Trimmed like the code typed at login, which must match it.
        const code = loginCode.trim();
        if (code.length < MIN_ACCESS_CODE_LENGTH) {
            loginError = m['auth.access_code_too_short']({ min: MIN_ACCESS_CODE_LENGTH });
            return;
        }
        if (code !== confirmCode.trim()) {
            loginError = m['admin.access_code_mismatch']();
            return;
        }
        if (!setupToken.trim()) {
            loginError = m['auth.please_enter_setup_token']();
            return;
        }

        isLoggingIn = true;
        loginError = '';
        const result = await auth.setFirstAccessCode(code, setupToken);
        isLoggingIn = false;

        if (result.outcome === 'set') {
            completeLogin(m['auth.access_code_set']());
        } else if (result.outcome === 'taken') {
            // The store now says a code exists, which turns the dialog into the login form.
            loginError = m['auth.access_code_already_set']();
            loginCode = '';
            confirmCode = '';
        } else if (result.outcome === 'blocked') {
            loginError = m['auth.too_many_attempts']({ seconds: result.retryAfter });
        } else {
            loginError =
                result.outcome === 'wrong_token'
                    ? m['auth.invalid_setup_token']()
                    : m['auth.login_error_occurred']();
        }
    }

    function completeLogin(message: string) {
        toasts.add(message, 'success');
        open = false;
        // Reruns every load, which drops the data preloaded while logged out, such as the redirect
        // of /admin that hovering its link fetched: otherwise the next click is sent back to
        // /wines?login. The ?login that may have opened the dialog goes too.
        const url = new URL(page.url.href);
        url.searchParams.delete('login');
        goto(url, { replace: true, reset: false, refreshAll: true });
    }

    function submit(event: SubmitEvent) {
        event.preventDefault();
        if (isLoggingIn) return;
        if (isChoosingCode) handleChooseCode();
        else handleLogin();
    }
</script>

<!-- A click outside does not close it: a lost click would also leave a page that needs a session. -->
<Dialog bind:open onOpenChange={handleOpenChange}>
    <DialogContent class="max-w-md" interactOutsideBehavior="ignore">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-3">
                <span
                    class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
                >
                    <Lock class="h-5 w-5 text-primary" />
                </span>
                {isChoosingCode ? m['auth.choose_access_code']() : m['auth.access_code_required']()}
            </DialogTitle>
            <DialogDescription>
                {isChoosingCode
                    ? m['auth.choose_access_code_description']()
                    : m['auth.enter_access_code']()}
            </DialogDescription>
        </DialogHeader>

        <form class="space-y-4" onsubmit={submit}>
            <div class="space-y-2">
                <Label for="login-code">
                    {isChoosingCode ? m['auth.new_access_code']() : m['auth.access_code']()}
                </Label>
                <Input
                    id="login-code"
                    type="password"
                    bind:value={loginCode}
                    placeholder={isChoosingCode
                        ? m['placeholders.enter_new_access_code']()
                        : m['auth.enter_access_code_placeholder']()}
                    aria-describedby={codeMissing ? 'login-code-missing' : undefined}
                />
                {#if codeMissing}
                    <p id="login-code-missing" class="text-xs text-muted-foreground">
                        {isChoosingCode
                            ? m['auth.new_access_code_missing']()
                            : m['auth.access_code_missing']()}
                    </p>
                {/if}
                {#if isChoosingCode}
                    <Label for="confirm-code">{m['auth.confirm_access_code']()}</Label>
                    <Input
                        id="confirm-code"
                        type="password"
                        bind:value={confirmCode}
                        placeholder={m['placeholders.confirm_new_access_code']()}
                    />
                    <Label for="setup-token">{m['auth.setup_token']()}</Label>
                    <Input
                        id="setup-token"
                        type="text"
                        placeholder={m['auth.setup_token_placeholder']()}
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        aria-describedby="setup-token-hint"
                        bind:value={setupToken}
                    />
                    <p id="setup-token-hint" class="text-xs text-muted-foreground">
                        {m['auth.setup_token_hint']()}
                    </p>
                {/if}
                {#if loginError}
                    <p class="text-sm text-destructive" role="alert">{loginError}</p>
                {/if}
            </div>

            <DialogFooter>
                <DialogClose type="button" class={buttonVariants({ variant: 'outline' })}>
                    {m['common.cancel']()}
                </DialogClose>
                <Button type="submit" disabled={codeMissing || isLoggingIn}>
                    {#if isLoggingIn}
                        <span
                            class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"
                            aria-hidden="true"
                        ></span>
                    {/if}
                    {isChoosingCode ? m['common.save']() : m['common.login']()}
                </Button>
            </DialogFooter>
        </form>
    </DialogContent>
</Dialog>
