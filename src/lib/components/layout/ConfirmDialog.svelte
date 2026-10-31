<script lang="ts">
    import { beforeNavigate } from '$app/navigation';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { CircleAlert } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { confirmation } from '#lib/components/layout/confirm.svelte.js';

    // A question belongs to the page that asked it: leaving the page, with the browser's back
    // button too, cancels it, rather than confirm it on another page.
    beforeNavigate(() => confirmation.answer(false));
</script>

<!-- Rendered once by the root layout; confirm() fills it. Closing it any other way cancels. Each
     question mounts it again, so that it comes after, and over, a dialog that asks it, such as the
     container dialog. -->
{#key confirmation.question}
    <Dialog open={confirmation.open} onOpenChange={(open) => !open && confirmation.answer(false)}>
        <DialogContent class="max-w-md">
            <DialogHeader>
                <DialogTitle>{m['common.confirm']()}</DialogTitle>
            </DialogHeader>
            <div class="space-y-4 py-4">
                <div class="flex items-start gap-3">
                    <div
                        class="flex-shrink-0 w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center"
                    >
                        <CircleAlert class="h-5 w-5 text-destructive" />
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        {confirmation.question?.message}
                    </p>
                </div>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" onclick={() => confirmation.answer(false)}>
                        {confirmation.question?.cancelLabel ?? m['common.cancel']()}
                    </Button>
                    <Button variant="destructive" onclick={() => confirmation.answer(true)}>
                        {confirmation.question?.confirmLabel ?? m['common.delete']()}
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
{/key}
