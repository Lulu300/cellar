import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import type { BackupFileDTO } from '#lib/shared/dto.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { fakeLink } from '../../../../test/link';
import { downloadBackup, savePreviousData } from './backup-downloads';

const filename = 'cellar-backup-pre-restore-2026-10-30.zip';
const url = `/api/admin/download-backup?filename=${filename}`;
const backup = { filename } as BackupFileDTO;

const shownToasts = () => toasts.items.map(({ message, type }) => ({ message, type }));

function answer(response: Response) {
    vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(response))
    );
}

/**
 * A file answered by the server, whose body records whether the page read it: `pulls` counts the
 * chunks read, `cancel` is called when the page drops it unread.
 */
function fileAnswer() {
    const body = { pulls: 0, cancel: vi.fn() };
    const stream = new ReadableStream(
        {
            pull(controller) {
                body.pulls += 1;
                controller.enqueue(new Uint8Array(1024));
                if (body.pulls === 3) controller.close();
            },
            cancel: body.cancel
        },
        // No chunk is read ahead: only a read of the page pulls one.
        { highWaterMark: 0 }
    );
    return { response: new Response(stream), body };
}

const notFound = () =>
    Response.json(
        { error: { code: 'not_found', message: 'Backup file not found' } },
        { status: 404 }
    );

beforeEach(() => {
    toasts.items = [];
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('savePreviousData', () => {
    it('lets the browser download the backup of the previous data, and says so', async () => {
        const link = fakeLink();
        answer(fileAnswer().response);

        await savePreviousData(filename);

        expect(link).toMatchObject({ href: url, download: filename });
        expect(link.click).toHaveBeenCalled();
        expect(shownToasts()).toEqual([
            { type: 'success', message: m['toast.previous_data_downloaded']({ filename }) }
        ]);
    });

    it('says where to find the backup when the browser cannot download it', async () => {
        fakeLink();
        answer(notFound());

        await savePreviousData(filename);

        expect(shownToasts()).toEqual([
            {
                type: 'error',
                message: m['toast.previous_data_not_downloaded']({
                    filename,
                    error: m['errors.not_found']()
                })
            }
        ]);
    });

    it('says where to find the backup when the session expired, which the login dialog does not', async () => {
        fakeLink();
        answer(
            Response.json(
                { error: { code: 'unauthenticated', message: 'Session expired' } },
                { status: 401 }
            )
        );

        await savePreviousData(filename);

        expect(shownToasts()).toEqual([
            {
                type: 'error',
                message: m['toast.previous_data_not_downloaded_session_expired']({ filename })
            }
        ]);
    });
});

describe('downloadBackup', () => {
    it('lets the browser download a backup of the list without reading it in the page', async () => {
        const link = fakeLink();
        const { response, body } = fileAnswer();
        answer(response);

        await downloadBackup(backup);

        expect(link).toMatchObject({ href: url, download: filename });
        expect(link.click).toHaveBeenCalled();
        expect(body.pulls).toBe(0);
        expect(body.cancel).toHaveBeenCalled();
        expect(shownToasts()).toEqual([]);
    });

    it('says why a backup of the list cannot be downloaded', async () => {
        fakeLink();
        answer(notFound());

        await downloadBackup(backup);

        expect(shownToasts()).toEqual([
            {
                type: 'error',
                message: m['toast.backup_download_failed']({
                    filename,
                    error: m['errors.not_found']()
                })
            }
        ]);
    });
});
