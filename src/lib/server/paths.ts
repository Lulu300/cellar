import path from 'node:path';

// Each folder but DEFAULT_CSV_DIR can be moved with the environment variable of the same name. The
// paths are relative to the working directory, /app in the Docker image, where the volumes mount.

/** The database (unless DATABASE_PATH moves it), the backups and exports, and temporary files. */
export const DATA_DIR = process.env.DATA_DIR || './data';
export const DATABASE_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'cellar.db');
const UPLOADS_DIR = process.env.UPLOADS_DIR || './static/uploads';
export const IMAGES_DIR = `${UPLOADS_DIR}/wines`;
/** Editable copies of the default CSV files: each start copies there the ones it lacks. */
export const CSV_IMPORTS_DIR = process.env.CSV_IMPORTS_DIR || './csv-imports';
/** The default CSV files, part of the app: their only copy in git, at the same place in the image. */
export const DEFAULT_CSV_DIR = './scripts/data';
/** Value of `wineImages.path`: the URL prefix under which IMAGES_DIR is served. */
export const IMAGES_URL_PATH = '/uploads/wines/';

/** The URL an image row is served at. */
export function imageUrl(image: { path: string; filename: string }): string {
    // Encoded: a renamed image may hold a space, `#` or `?`, which would end the path
    return `${image.path}${encodeURIComponent(image.filename)}`;
}

// Permissive on purpose: image names come from user renames and may hold spaces, accents or
// apostrophes. Refused: separators and control characters (the null byte included), which can
// leave the directory or corrupt logs and headers, and a leading dot, which would expose hidden
// files such as .DS_Store through /uploads (and covers `.` and `..`).
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const ALLOWED_NAME = /^[^.\x00-\x1f\x7f/\\][^\x00-\x1f\x7f/\\]*$/;

/**
 * Returns the absolute path of the file `name` directly inside `dir`, or null when `name` is not
 * a plain file name: not a string, empty, starting with a dot (`.` and `..` included), or holding
 * a separator or a control character.
 *
 * It returns null instead of throwing because routes wrap their handler in a catch-all that would
 * turn an exception into a 500. Each route maps null itself: 400 when the name comes from the
 * request, "missing file" when it comes from the database.
 */
export function resolveInDir(dir: string, name: unknown): string | null {
    if (typeof name !== 'string' || !ALLOWED_NAME.test(name)) return null;

    const root = path.resolve(dir);
    const resolved = path.resolve(root, name);
    // Defence in depth should the pattern ever be loosened: only a direct child of `dir` is accepted.
    return path.dirname(resolved) === root ? resolved : null;
}

export const INVALID_IMAGE_FILENAME_ERROR = 'Invalid image filename: it must be a plain file name';

/**
 * Imports must check image names with this: the image routes later read and delete
 * IMAGES_DIR/<filename>, so a stored `../../data/cellar.db` would reach the database file.
 */
export function isImageFileName(name: unknown): name is string {
    return resolveInDir(IMAGES_DIR, name) !== null;
}
