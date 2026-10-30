import { mkdtempSync } from 'node:fs';
import path from 'node:path';

/** A new folder in the scratch folder of the test file, which setup.ts removes after its tests. */
export function scratchFolder(prefix: string): string {
    return mkdtempSync(path.join(path.dirname(process.env.DATA_DIR!), prefix));
}
