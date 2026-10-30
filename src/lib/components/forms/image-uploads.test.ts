import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageUploads } from './image-uploads';

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * A fake API: each upload gets the next id; deleting an id of `inUse` is refused. `deletions` lists
 * the ids of each DELETE, in order.
 */
function fakeApi(inUse: string[] = []) {
    let uploads = 0;
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === 'POST') {
            uploads += 1;
            return Response.json({ imageId: `image-${uploads}`, url: '/uploads/wines/x.jpg' });
        }
        const [id] = JSON.parse(init.body as string).imageIds;
        return inUse.includes(id)
            ? Response.json(
                  { error: { code: 'in_use', message: 'Images are used by wines' } },
                  { status: 409 }
              )
            : new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetch);
    const deletions = () =>
        fetch.mock.calls
            .filter(([url, init]) => url === '/api/admin/images' && init.method === 'DELETE')
            .map(([, init]) => JSON.parse(init.body as string).imageIds);
    return { deletions };
}

const file = () => new File(['label'], 'label.jpg', { type: 'image/jpeg' });

/** A save of the form that uploads a file and ends, saving `saved` when given. */
async function save(uploads: ImageUploads, saved?: string) {
    uploads.startSave();
    await uploads.upload(file());
    if (saved) uploads.saved(saved);
    await uploads.endSave();
}

describe('ImageUploads', () => {
    it('deletes, once the form closes, the images uploaded for saves the server refused', async () => {
        const api = fakeApi();
        const uploads = new ImageUploads();
        await save(uploads);
        await save(uploads);

        await uploads.close();

        expect(api.deletions()).toEqual([['image-1'], ['image-2']]);
    });

    it('keeps the image of the saved wine, and deletes only the others', async () => {
        const api = fakeApi();
        const uploads = new ImageUploads();
        await save(uploads);
        await save(uploads, 'image-2');

        await uploads.close();

        expect(api.deletions()).toEqual([['image-1']]);
    });

    it('sends nothing when it uploaded nothing, or when the saved wine uses the only upload', async () => {
        const api = fakeApi();
        await new ImageUploads().close();
        const uploads = new ImageUploads();
        await save(uploads, 'image-1');

        await uploads.close();

        expect(api.deletions()).toEqual([]);
    });

    it('waits for the save running when the form closes, which may use the images', async () => {
        const api = fakeApi();
        const uploads = new ImageUploads();
        await save(uploads);
        uploads.startSave();

        // Closed while the save sends the image uploaded before, and while it uploads a new one
        await uploads.close();
        expect(api.deletions()).toEqual([]);
        await uploads.upload(file());
        uploads.saved('image-1');
        await uploads.endSave();

        expect(api.deletions()).toEqual([['image-2']]);
    });

    it('still deletes the others when one image is used after all', async () => {
        const api = fakeApi(['image-1']);
        const uploads = new ImageUploads();
        await save(uploads);
        await save(uploads);

        await expect(uploads.close()).resolves.toBeUndefined();

        expect(api.deletions()).toEqual([['image-1'], ['image-2']]);
    });
});
