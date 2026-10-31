/** What the image searches read of an image. */
export interface SearchedImage {
    id: string;
    filename: string;
    /**
     * The wines and the wishes that use the image: their names tell apart images whose names are
     * random.
     */
    wines: { name: string }[];
    wishes: { name: string }[];
}

/**
 * Whether the file name of `image`, or the name of a wine or a wish that uses it, holds `query`,
 * ignoring case.
 */
export function matchesImageSearch(image: SearchedImage, query: string): boolean {
    const needle = query.trim().toLowerCase();
    const users = [...image.wines, ...image.wishes].map((user) => user.name);
    return [image.filename, ...users].some((name) => name.toLowerCase().includes(needle));
}
