import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import {
    BottleChanges,
    newStatus,
    proposedStatus,
    statusChoices
} from './bottle-changes.svelte.js';

const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;

describe('newStatus', () => {
    // The note goes after the notes of each bottle: as a change of `notes`, it replaced them.
    it('sends the date, and the trimmed note to add to the notes, with a consumption', () => {
        expect(newStatus(BottleAvailability.CONSUMED, '2026-10-17', '  with friends ')).toEqual({
            changes: { availability: BottleAvailability.CONSUMED, consumedDate: '2026-10-17' },
            addedNote: 'with friends'
        });
    });

    it('sends no note when a consumption has none', () => {
        expect(newStatus(BottleAvailability.CONSUMED, '2026-10-17', '  ')).toEqual({
            changes: { availability: BottleAvailability.CONSUMED, consumedDate: '2026-10-17' }
        });
    });

    // The note field shows only under "Consumed": a note typed there, then hidden by picking
    // another status, used to replace the notes of every selected bottle.
    it.each([BottleAvailability.AVAILABLE, BottleAvailability.OUT_OF_CELLAR])(
        'sends neither the date nor a hidden note for %s',
        (availability) => {
            expect(newStatus(availability, '2026-10-17', 'hidden text')).toEqual({
                changes: { availability }
            });
        }
    );
});

describe('the status picker', () => {
    it('offers every status but the one all the bottles share, and proposes a consumption', () => {
        const choices = statusChoices([AVAILABLE, AVAILABLE]);
        expect(choices).toEqual([OUT_OF_CELLAR, CONSUMED]);
        expect(proposedStatus(choices)).toBe(CONSUMED);
    });

    it('offers every status for bottles that do not share one', () => {
        expect(statusChoices([AVAILABLE, OUT_OF_CELLAR])).toEqual([
            AVAILABLE,
            OUT_OF_CELLAR,
            CONSUMED
        ]);
    });

    it('offers the bottles out of the cellar to go back or to be consumed', () => {
        expect(statusChoices([OUT_OF_CELLAR, OUT_OF_CELLAR])).toEqual([AVAILABLE, CONSUMED]);
    });

    it('proposes the first status listed when the bottles are all consumed', () => {
        const choices = statusChoices([CONSUMED]);
        expect(choices).toEqual([AVAILABLE, OUT_OF_CELLAR]);
        expect(proposedStatus(choices)).toBe(AVAILABLE);
    });
});

describe('BottleChanges', () => {
    const fetchMock = vi.fn<typeof fetch>();
    const shownToasts = () => toasts.items.map(({ message, type }) => ({ message, type }));

    beforeEach(() => {
        toasts.items = [];
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function changes() {
        const onSaved = vi.fn();
        const onMissing = vi.fn();
        return { changes: new BottleChanges({ onSaved, onMissing }), onSaved, onMissing };
    }

    const sentBodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

    // A double click on Confirm sent the note twice: it is added after the notes of each bottle.
    it('sends one request when Confirm is clicked again while the first is on its way', async () => {
        let answer!: (response: Response) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
        const { changes: sender, onSaved } = changes();
        const update = newStatus(CONSUMED, '2026-10-24', 'with friends');

        const first = sender.send(['b1'], update);
        expect(sender.sending).toBe(true);
        const second = sender.send(['b1'], update);
        answer(Response.json({ bottles: [] }));
        await Promise.all([first, second]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledExactlyOnceWith(1);
        expect(sender.sending).toBe(false);
    });

    it('stays sending until the screen has reloaded its bottles', async () => {
        fetchMock.mockResolvedValue(Response.json({ bottles: [] }));
        let reloaded!: () => void;
        const sender = new BottleChanges({
            onSaved: () => new Promise<void>((resolve) => (reloaded = resolve)),
            onMissing: vi.fn()
        });

        const sending = sender.send(['b1'], newStatus(AVAILABLE, '', ''));
        await vi.waitFor(() => expect(reloaded).toBeDefined());
        expect(sender.sending).toBe(true);
        await sender.send(['b1'], newStatus(AVAILABLE, '', ''));
        reloaded();
        await sending;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sender.sending).toBe(false);
    });

    // The wine page swallowed the error: nothing said that the bottle had not changed.
    it('shows a message when the server cannot be reached, and can send again', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const { changes: sender, onSaved, onMissing } = changes();

        await sender.send(['b1'], newStatus(CONSUMED, '2026-10-24', ''));

        expect(shownToasts()).toEqual([{ message: m['errors.network_error'](), type: 'error' }]);
        expect(onSaved).not.toHaveBeenCalled();
        expect(onMissing).not.toHaveBeenCalled();
        expect(sender.sending).toBe(false);

        fetchMock.mockResolvedValueOnce(Response.json({ bottles: [] }));
        await sender.send(['b1'], newStatus(CONSUMED, '2026-10-24', ''));
        expect(onSaved).toHaveBeenCalledOnce();
    });

    // The dialogs returned without a request or a message when the date was empty.
    it('sends a consumption without a date', async () => {
        fetchMock.mockResolvedValue(Response.json({ bottles: [] }));
        const { changes: sender, onSaved } = changes();

        await sender.send(['b1'], newStatus(CONSUMED, '', ''));

        expect(sentBodies()).toEqual([
            { ids: ['b1'], changes: { availability: CONSUMED, consumedDate: '' } }
        ]);
        expect(onSaved).toHaveBeenCalledOnce();
    });

    it('shows the reason of a refusal', async () => {
        const full = { caseName: 'Rack A', capacity: 2, bottles: 3 };
        fetchMock.mockResolvedValue(
            Response.json(
                { error: { code: 'case_full', message: 'Full', details: full } },
                { status: 409 }
            )
        );
        const { changes: sender, onSaved, onMissing } = changes();

        await sender.send(['b1'], { changes: { storageCaseId: 'c1' } });

        expect(shownToasts()).toEqual([{ message: m['errors.case_full'](full), type: 'error' }]);
        expect(onSaved).not.toHaveBeenCalled();
        expect(onMissing).not.toHaveBeenCalled();
    });

    const notFound = (details?: unknown) =>
        Response.json(
            { error: { code: 'not_found', message: 'No bottle', details } },
            { status: 404 }
        );

    // The screens reload the list after a 404: the message asked to reload it again.
    it('names the bottle deleted elsewhere, without asking to reload the list', async () => {
        fetchMock.mockResolvedValue(notFound({ ids: ['b1'] }));
        const { changes: sender, onSaved, onMissing } = changes();

        await sender.send(['b1'], newStatus(OUT_OF_CELLAR, '', ''));

        expect(onMissing).toHaveBeenCalledExactlyOnceWith(['b1']);
        expect(onSaved).not.toHaveBeenCalled();
        expect(shownToasts()).toEqual([
            { message: 'This bottle no longer exists. The list is up to date.', type: 'error' }
        ]);
    });

    it('says how many of the bottles sent were deleted elsewhere', async () => {
        fetchMock.mockResolvedValue(notFound({ ids: ['b2'] }));
        const { changes: sender, onMissing } = changes();

        await sender.send(['b1', 'b2', 'b3'], newStatus(CONSUMED, '', ''));

        expect(onMissing).toHaveBeenCalledExactlyOnceWith(['b2']);
        expect(shownToasts()).toEqual([
            {
                message: '1 of these bottles no longer exists. The list is up to date.',
                type: 'error'
            }
        ]);
    });

    it('says the list is up to date once the screen has reloaded it', async () => {
        fetchMock.mockResolvedValue(notFound({ ids: ['b1'] }));
        let reloaded!: () => void;
        const sender = new BottleChanges({
            onSaved: vi.fn(),
            onMissing: () => new Promise<void>((resolve) => (reloaded = resolve))
        });

        const sending = sender.send(['b1'], newStatus(CONSUMED, '', ''));
        await vi.waitFor(() => expect(reloaded).toBeDefined());
        expect(shownToasts()).toEqual([]);
        reloaded();
        await sending;

        expect(shownToasts()).toHaveLength(1);
    });

    it('shows the general message of a 404 that names no bottle', async () => {
        fetchMock.mockResolvedValue(notFound());
        const { changes: sender, onMissing } = changes();

        await sender.send(['b1'], newStatus(CONSUMED, '', ''));

        expect(onMissing).not.toHaveBeenCalled();
        expect(shownToasts()).toEqual([{ message: m['errors.not_found'](), type: 'error' }]);
    });
});
