import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { onTestFinished } from 'vitest';
import type { Db } from '#lib/server/db/connection.js';
import { appellations, countries, regions } from '#lib/server/db/schema.js';
import { CSV_IMPORTS_DIR } from '#lib/server/paths.js';

/** label_presets.csv as 0.1.0 to 0.8.0 shipped it. */
export const LABEL_PRESETS_0_8_0 = 'src/test/label_presets-0.8.0.csv';
/** label_presets.csv as 0.9.0 to 0.10.0 shipped it, with Avery 8160 described as a laser sheet. */
export const LABEL_PRESETS_0_10_0 = 'src/test/label_presets-0.10.0.csv';

/** The names of the countries, regions and appellations of `database`. */
export async function locationNames(database: Db) {
    return {
        countries: (await database.select().from(countries)).map((country) => country.name),
        regions: (await database.select().from(regions)).map((region) => region.name),
        appellations: (await database.select().from(appellations)).map(
            (appellation) => appellation.name
        )
    };
}

/** Writes the user's copy of a default CSV file; the next seed copies the default back after the test. */
export function writeUserCsv(filename: string, content: string | Buffer): string {
    const file = path.join(CSV_IMPORTS_DIR, filename);
    writeFileSync(file, content);
    onTestFinished(() => rmSync(file));
    return file;
}
