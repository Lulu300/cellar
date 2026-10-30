<script lang="ts">
    import { TriangleAlert, ClipboardCheck } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { getLocale } from '#lib/paraglide/runtime.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Checkbox } from '#lib/components/ui/checkbox/index.js';
    import InlineMarkdown from '#lib/components/admin/InlineMarkdown.svelte';
    import type { UpgradeNotice } from '#lib/server/upgrade.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { request } from '#lib/api/client.js';
    import {
        actionKey,
        keepShown,
        type UpgradeAction
    } from '#lib/components/admin/upgrade-actions.js';

    let { actions, prerequisite }: UpgradeNotice = $props();

    // The admin layout keeps the banner from page to page: a ticked action stays listed, so that
    // a wrong tick can be undone, until the user leaves the admin or reloads the page. `listed` is
    // the memory of the derived, not state: it reads the list it gave last, to add the new actions.
    let listed: UpgradeAction[] = [];
    const shown = $derived.by(() => {
        listed = keepShown(listed, actions);
        return listed;
    });
    let done = $state<Record<string, boolean>>({});
    const allDone = $derived(shown.every((action) => done[actionKey(action)]));

    async function setDone(action: UpgradeAction, checked: boolean) {
        done[actionKey(action)] = checked;
        try {
            await request('/api/admin/upgrade-actions', {
                method: 'PUT',
                json: { version: action.version, index: action.index, done: checked }
            });
        } catch {
            done[actionKey(action)] = !checked;
            toasts.add(m['admin.upgrade.save_failed'](), 'error');
        }
    }
</script>

{#if prerequisite}
    <Card class="mb-6 border-destructive" role="alert">
        <CardHeader>
            <CardTitle class="flex items-center gap-2 text-destructive">
                <TriangleAlert class="h-5 w-5" />
                {m['admin.upgrade.prerequisite_title']()}
            </CardTitle>
        </CardHeader>
        <CardContent>
            {#if prerequisite === 'origin'}
                {m['admin.upgrade.origin_missing']()}
            {:else}
                {m['admin.upgrade.origin_not_applied']()}
            {/if}
        </CardContent>
    </Card>
{/if}

{#if shown.length > 0}
    <Card class="mb-6 border-warning">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <ClipboardCheck class="h-5 w-5" />
                {m['admin.upgrade.title']()}
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <p>{m['admin.upgrade.intro']()}</p>
            {#if getLocale() !== 'en'}
                <p class="text-sm text-muted-foreground">{m['admin.upgrade.english_note']()}</p>
            {/if}
            {#if shown.some((action) => action.mayBeDone)}
                <p class="text-sm text-muted-foreground">{m['admin.upgrade.may_be_done_hint']()}</p>
            {/if}
            <ul class="space-y-3">
                {#each shown as action (actionKey(action))}
                    {@const id = `upgrade-action-${actionKey(action)}`}
                    <li class="flex items-start gap-3">
                        <Checkbox
                            {id}
                            class="mt-1"
                            checked={done[actionKey(action)] ?? false}
                            onCheckedChange={(checked) => setDone(action, checked)}
                        />
                        <label
                            for={id}
                            class={done[actionKey(action)] ? 'line-through opacity-60' : ''}
                        >
                            <Badge variant="outline">{action.version}</Badge>
                            {#if action.mayBeDone}
                                <Badge variant="secondary">{m['admin.upgrade.may_be_done']()}</Badge
                                >
                            {/if}
                            <span lang="en"><InlineMarkdown source={action.text} /></span>
                        </label>
                    </li>
                {/each}
            </ul>
            {#if allDone}
                <p class="text-sm font-medium">{m['admin.upgrade.all_done']()}</p>
            {/if}
        </CardContent>
    </Card>
{/if}
