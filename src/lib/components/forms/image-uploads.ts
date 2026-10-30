import { request } from '#lib/api/client.js';
import type { UploadedImageDTO } from '#lib/shared/dto.js';

/**
 * The images that a wine form uploads when it saves. Those that no saved wine uses, such as one sent
 * before the server refused the save, are deleted when the form closes (decision UI-06), or once the
 * save running then has ended: it may still use them.
 */
export class ImageUploads {
    #unsaved: string[] = [];
    #saving = false;
    #closed = false;

    /** A save starts: until it ends, closing the form deletes nothing. */
    startSave() {
        this.#saving = true;
    }

    /** Uploads `file` for the save running; throws the ApiError of a refusal. */
    async upload(file: File): Promise<UploadedImageDTO> {
        const body = new FormData();
        body.append('image', file);
        const uploaded = await request<UploadedImageDTO>('/api/upload/image', {
            method: 'POST',
            body
        });
        this.#unsaved.push(uploaded.imageId);
        return uploaded;
    }

    /** A wine was saved with this image, which stays. */
    saved(imageId: string | null) {
        this.#unsaved = this.#unsaved.filter((id) => id !== imageId);
    }

    /** The save has ended, saved or not. */
    async endSave(): Promise<void> {
        this.#saving = false;
        if (this.#closed) await this.#discard();
    }

    /** The form closes. */
    async close(): Promise<void> {
        this.#closed = true;
        if (!this.#saving) await this.#discard();
    }

    /** Deletes the uploaded images that no saved wine uses. */
    async #discard(): Promise<void> {
        const imageIds = this.#unsaved;
        this.#unsaved = [];
        // One by one and without force: should a wine use one after all, as when the answer to a
        // save was lost, the server refuses (409) and that image stays, but not the others. Nothing
        // to tell a user who closed the form.
        await Promise.all(
            imageIds.map((id) =>
                request('/api/admin/images', { method: 'DELETE', json: { imageIds: [id] } }).catch(
                    () => {}
                )
            )
        );
    }
}
