/** What the image searches read of an image. */
export interface SearchedImage {
    id: string;
    filename: string;
    /** The wines that use the image: their names tell apart images whose names are random. */
    wines: { name: string }[];
}

/** Whether the file name of `image`, or the name of a wine that uses it, holds `query`, ignoring case. */
export function matchesImageSearch(image: SearchedImage, query: string): boolean {
    const needle = query.trim().toLowerCase();
    return [image.filename, ...image.wines.map((wine) => wine.name)].some((name) =>
        name.toLowerCase().includes(needle)
    );
}
