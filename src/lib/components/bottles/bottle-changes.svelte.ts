import { ApiError, errorMessage, request } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';
import type { BulkBottleChangesBody } from '#lib/shared/schemas/bottle.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { toasts } from '#lib/stores/toast.svelte.js';

/** What a PATCH of bottles does to each of them: its changes, and a note to add. */
export type BottlesUpdate = Omit<BulkBottleChangesBody, 'ids'>;

const STATUSES = Object.values(BottleAvailability);

/** The statuses the status picker offers: every one but the status all the bottles share. */
export function statusChoices(current: string[]): BottleAvailability[] {
    const shared = current.every((status) => status === current[0]) ? current[0] : undefined;
    return STATUSES.filter((status) => status !== shared);
}

/** The status proposed first: a consumption, the most common change, when the bottles can take it. */
export function proposedStatus(choices: BottleAvailability[]): BottleAvailability {
    return choices.includes(BottleAvailability.CONSUMED) ? BottleAvailability.CONSUMED : choices[0];
}

/**
 * The update that gives bottles a new status. The consumption date and the note go only with a
 * consumption: the dialogs show the note field only under Consumed, so a note left there after
 * picking another status must not reach the bottles. A non-blank note goes after their notes. An
 * empty date saves the consumption without a date.
 */
export function newStatus(
    availability: BottleAvailability,
    consumedDate: string,
    note: string
): BottlesUpdate {
    if (availability !== BottleAvailability.CONSUMED) return { changes: { availability } };
    return {
        changes: { availability, consumedDate },
        ...(note.trim() && { addedNote: note.trim() })
    };
}

/**
 * Sends the changes of bottles, one request at a time, with the error handling of every screen
 * that changes them. `sending` disables the buttons that send: a second click while a request is
 * on its way sends nothing, so a note is not added twice.
 */
export class BottleChanges {
    sending = $state(false);

    constructor(
        private readonly handlers: {
            /** After the change, still `sending`: the screen reloads its bottles. */
            onSaved: (count: number) => Promise<void> | void;
            /** Bottles deleted elsewhere, which the server named: the screen drops and reloads them. */
            onMissing: (ids: string[]) => Promise<void> | void;
        }
    ) {}

    /** Applies `update` to each bottle of `ids` in one request, which changes all of them or none. */
    async send(ids: string[], update: BottlesUpdate): Promise<void> {
        if (this.sending || ids.length === 0) return;
        this.sending = true;
        // Still sending until the screen has reloaded its bottles, so that a click on the old
        // list cannot send the change again.
        try {
            try {
                await request('/api/bottles', { method: 'PATCH', json: { ids, ...update } });
            } catch (error) {
                await this.refused(error, ids.length);
                return;
            }
            await this.handlers.onSaved(ids.length);
        } finally {
            this.sending = false;
        }
    }

    /** Shows why nothing changed: a refusal of the server, or no answer at all. */
    private async refused(error: unknown, sent: number) {
        const missing =
            error instanceof ApiError && error.code === 'not_found'
                ? (error.details<{ ids?: string[] } | undefined>()?.ids ?? [])
                : [];
        if (missing.length === 0) {
            toasts.add(errorMessage(error), 'error');
            return;
        }
        await this.handlers.onMissing(missing);
        // The screen has reloaded its list: the general 404 message would ask to reload it.
        toasts.add(
            m['toast.bottles_deleted_elsewhere']({ count: missing.length, total: sent }),
            'error'
        );
    }
}
