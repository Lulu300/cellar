// For the scripts that start the built app on throwaway data (check-origin.mjs, e2e/server.mjs).
import path from 'node:path';

/**
 * The environment variables of every folder the app writes to (src/lib/server/paths.ts), all inside
 * `root`. Each one is set even when another one derives it, so that a value inherited from the
 * shell cannot point back to real data.
 * @param {string} root
 */
export function throwawayDataPaths(root) {
    return {
        DATA_DIR: path.join(root, 'data'),
        DATABASE_PATH: path.join(root, 'data', 'cellar.db'),
        UPLOADS_DIR: path.join(root, 'uploads'),
        CSV_IMPORTS_DIR: path.join(root, 'csv-imports')
    };
}
