import { m } from '#lib/paraglide/messages.js';

type ToastType = 'success' | 'error' | 'warning';

interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

/** The notifications shown in the corner of the page. */
class Toasts {
    items = $state<ToastMessage[]>([]);
    // Ids only need to be unique within the page. Not crypto.randomUUID: browsers only offer it
    // over HTTPS or on localhost, and Cellar is often reached over plain HTTP on the LAN.
    #lastId = 0;

    /** Shows a message, for duration milliseconds (0 keeps it until closed). */
    add(message: string, type: ToastType = 'error', duration = 5000) {
        // A request refused for want of a session opens the login dialog (+layout.svelte): the
        // error of the action that sent it would repeat it beside the dialog, alone or within the
        // message of the action ("Failed to delete backup: <that error>").
        if (type === 'error' && message.includes(m['errors.unauthenticated']())) return;
        this.#lastId += 1;
        const id = String(this.#lastId);
        this.items.push({ id, message, type });
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
    }

    remove(id: string) {
        this.items = this.items.filter((toast) => toast.id !== id);
    }
}

export const toasts = new Toasts();
