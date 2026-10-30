import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { removeStagedDatabase } from '#lib/server/db/index.js';
import { DATA_DIR } from '#lib/server/paths.js';

// What the services write in DATA_DIR while they run, and remove when they end, under the names
// they give: the zips and snapshots of a backup (`.partial`, and the journal that SQLite may keep
// next to a snapshot; archive.ts), the upload and extraction of a restore (`temp-restore-`,
// `temp-extract-`; backup/service.ts), of a JSON import (`temp-import-`, `temp-extract-import-`;
// backup/json-import.ts), of an image import (`temp-zip-import-`; images/service.ts) and the zip
// of a download of images (`temp-images-`; images/service.ts).
const LEFTOVER =
    /^(?:cellar-(?:backup|export)-.*\.partial(?:-journal)?|temp-(?:restore|extract|import|zip-import|images)-.+)$/;

/**
 * Removes what a stop (a crash, `kill -9`, a full disk) left of the files and folders that backups,
 * restores and imports write while they run: hundreds of MB for a large restore. Run at startup,
 * before any of them starts; what it cannot remove is logged, as the server must start anyway.
 */
export function removeLeftoverFiles(): void {
    for (const name of readdirSync(DATA_DIR).filter((name) => LEFTOVER.test(name))) {
        removeOrLog(name, () =>
            rmSync(path.join(DATA_DIR, name), { recursive: true, force: true })
        );
    }
    removeOrLog('the copy of a database being restored', removeStagedDatabase);
}

function removeOrLog(name: string, remove: () => void): void {
    try {
        remove();
    } catch (error) {
        console.error(`Could not remove ${name}, left by a stop:`, error);
    }
}
