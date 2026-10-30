import { filenameFromContentDisposition } from './content-disposition.js';

/**
 * Makes the browser download `url` and save it as `filename`, as a link does: the file goes
 * straight to the disk, never whole in the page's memory, and the page does not wait for it.
 */
export function saveUrl(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/** Makes the browser save `blob` as `filename`. */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    saveUrl(url, filename);
    URL.revokeObjectURL(url);
}

/**
 * Makes the browser save the body of `response` under the name its Content-Disposition gives,
 * and returns that name.
 */
export async function saveResponse(response: Response, fallbackName: string): Promise<string> {
    const filename =
        filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;
    saveBlob(await response.blob(), filename);
    return filename;
}
