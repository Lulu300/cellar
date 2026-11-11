/** What the image searches read of an image. */
export interface SearchedImage {
    id: string;
    filename: string;
    /**
     * The wines, producers and wishes that use the image: their names tell apart images whose names
     * are random.
     */
    wines: { name: string }[];
    producers: { name: string }[];
    wishes: { name: string }[];
}

/**
 * Whether the file name of `image`, or the name of a wine, producer or wish that uses it, holds `query`,
 * ignoring case.
 */
export function matchesImageSearch(image: SearchedImage, query: string): boolean {
    const needle = query.trim().toLowerCase();
    const users = [...image.wines, ...image.producers, ...image.wishes].map((user) => user.name);
    return [image.filename, ...users].some((name) => name.toLowerCase().includes(needle));
}
