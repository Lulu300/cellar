import type { SvelteSet } from 'svelte/reactivity';
import { askToLogIn } from '#lib/components/layout/login-prompt.js';
import { auth } from '#lib/stores/auth.svelte.js';

/**
 * Runs `action` for a session. A visitor gets the login dialog instead, over the list, which keeps
 * its selection: once logged in, the visitor asks again, as the action does not run by itself.
 */
export function whenLoggedIn(action: () => void): void {
    if (auth.isAuthenticated) action();
    else askToLogIn();
}

/**
 * The bottles of a list whose status, place or drinking window changes, while their dialog is
 * open (BottleChangeDialogs), and what the list does after a change: it forgets its selection and
 * reloads its bottles.
 */
export class BottleDialogs<B extends { id: string }> {
    status = $state.raw<B[]>([]);
    moving = $state.raw<B[]>([]);
    dating = $state.raw<B[]>([]);

    constructor(
        private readonly selection: SvelteSet<string>,
        private readonly reload: () => Promise<unknown> | unknown
    ) {}

    saved = async () => {
        this.selection.clear();
        await this.reload();
    };

    /** Bottles deleted elsewhere: they leave the selection and the open dialogs, so that trying again can work. */
    missing = async (ids: string[]) => {
        const kept = (bottle: B) => !ids.includes(bottle.id);
        this.status = this.status.filter(kept);
        this.moving = this.moving.filter(kept);
        this.dating = this.dating.filter(kept);
        for (const id of ids) this.selection.delete(id);
        await this.reload();
    };
}
