import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { parse, type OptionsWithColumns } from 'csv-parse/sync';
import {
    appSettings,
    appellations,
    countries,
    labelPresets,
    regions,
    wineClassifications,
    wineColors,
    wineFormats,
    wineTypes
} from './schema';
import { blockingIssues } from '#lib/shared/labels.js';
import { labelPresetSchema } from '#lib/shared/schemas/label.js';
import { CSV_IMPORTS_DIR, DEFAULT_CSV_DIR } from '#lib/server/paths.js';
import type { Tx } from './connection';

/** The CSV file `filename`: the user's copy in CSV_IMPORTS_DIR, else the default one, else null. */
function getCsvPath(filename: string): string | null {
    for (const dir of [CSV_IMPORTS_DIR, DEFAULT_CSV_DIR]) {
        const csvPath = path.resolve(dir, filename);
        if (existsSync(csvPath)) return csvPath;
    }
    return null;
}

/**
 * The text of a CSV file: UTF-8, or Windows-1252 when it is not valid UTF-8, such as the
 * appellations.csv of 0.11.0 and earlier, in Latin-1, or a file that a spreadsheet saved as "CSV"
 * under Windows. The decoder drops the byte order mark that Excel's "CSV UTF-8" starts with, which
 * would otherwise stick to the first column name.
 */
function decodeCsv(bytes: Buffer): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder('windows-1252').decode(bytes);
    }
}

/**
 * The records of the CSV file `filename` (see getCsvPath), or null when there is none. Read at
 * once, so that the seeding can run in a transaction, which better-sqlite3 runs synchronously.
 * A record with one of the `names` columns blank is skipped and logged: the API refuses an empty
 * name, and a line of spaces is easily left in a file edited by hand.
 */
function readCsvRecords<Column extends string = string>(
    filename: string,
    names: Column[] = [],
    options: OptionsWithColumns<Record<Column, string>> = { delimiter: ',', columns: true }
): Record<Column, string>[] | null {
    const csvPath = getCsvPath(filename);
    if (!csvPath) {
        console.log(`⚠️ ${filename} not found, skipping`);
        return null;
    }
    return parse(decodeCsv(readFileSync(csvPath)), {
        ...options,
        skip_empty_lines: true,
        on_record: (record, { lines }) => {
            const blank = names.filter((name) => record[name].trim() === '');
            if (blank.length === 0) return record;
            console.warn(`⚠️ ${filename}: line ${lines} skipped, no ${blank.join(', ')}`);
            return null;
        }
    });
}

/** A list table with its name column: a pair, so that the compiler ties the column to its table. */
type Lookup =
    | [typeof wineTypes, typeof wineTypes.type]
    | [typeof wineColors, typeof wineColors.color]
    | [typeof wineClassifications, typeof wineClassifications.name]
    | [typeof wineFormats, typeof wineFormats.name];

/** Inserts the names that `table` lacks in `column`, from the `name` column of `filename`. */
function importLookupCsv(db: Tx, [table, column]: Lookup, filename: string) {
    const records = readCsvRecords(filename, ['name']);
    if (!records?.length) return;
    const [key] = Object.entries(getTableColumns(table)).find(([, each]) => each === column)!;
    const rows = records.map((record) => ({ [key]: record.name.trim() }));
    // The names are unique: those already there are kept.
    const { changes } = db.insert(table).values(rows).onConflictDoNothing().run();
    console.log(`✓ ${filename}: ${changes} added`);
}

/** The header line of appellations.csv: Pays;Région;Appellation, or a variant made by hand. */
function isAppellationsHeader(record: { country: string; appellation: string }): boolean {
    return (
        /^(pays|country)$/i.test(record.country.trim()) ||
        /^appellations?( name)?$/i.test(record.appellation.trim())
    );
}

/** Inserts the countries, regions and appellations of appellations.csv that `db` lacks. */
function importAppellationsCsv(db: Tx, filename: string) {
    const columns = ['country', 'region', 'appellation'] as const;
    const records = readCsvRecords(filename, [...columns], {
        delimiter: ';',
        columns: [...columns]
    });
    if (!records) return;
    // The columns are named above, so the header line is skipped by hand. A copy edited by hand
    // may have none, and its first line is then an appellation, or a header of its own.
    if (records[0] && isAppellationsHeader(records[0])) records.shift();

    let added = 0;
    for (const record of records) {
        const countryName = record.country.trim();
        const regionName = record.region.trim();
        const appellationName = record.appellation.trim();

        const country =
            db.select().from(countries).where(eq(countries.name, countryName)).get() ??
            db.insert(countries).values({ name: countryName }).returning().get();
        const region =
            db
                .select()
                .from(regions)
                .where(and(eq(regions.name, regionName), eq(regions.countryId, country.id)))
                .get() ??
            db
                .insert(regions)
                .values({ name: regionName, countryId: country.id })
                .returning()
                .get();
        const appellation = db
            .select()
            .from(appellations)
            .where(
                and(eq(appellations.name, appellationName), eq(appellations.regionId, region.id))
            )
            .get();
        if (!appellation) {
            db.insert(appellations).values({ name: appellationName, regionId: region.id }).run();
            added++;
        }
    }
    console.log(`✓ ${filename}: ${added} appellations added`);
}

const APPELLATIONS_CSV = 'appellations.csv';
const LABEL_PRESETS_CSV = 'label_presets.csv';

/** A number of a CSV field, or undefined for an empty one, which the preset schema refuses. */
const csvNumber = (value: string | undefined) => (value?.trim() ? Number(value) : undefined);

/**
 * Inserts the presets of `filename` that `db` lacks, by name; returns how many. A row that the
 * preset API would refuse, such as one with an unknown page format or labels that the PDF cannot
 * print, is skipped and named: the user may have edited the file.
 */
function importLabelPresetsCsv(db: Tx, filename: string): number {
    const records = readCsvRecords(filename);
    if (!records?.length) return 0;
    const rows = [];
    for (const [index, record] of records.entries()) {
        const preset = labelPresetSchema.safeParse({
            name: record.name,
            description: record.description,
            pageFormat: record.page_format?.trim(),
            labelWidth: csvNumber(record.label_width),
            labelHeight: csvNumber(record.label_height),
            marginTop: csvNumber(record.margin_top),
            marginLeft: csvNumber(record.margin_left),
            marginBottom: csvNumber(record.margin_bottom),
            marginRight: csvNumber(record.margin_right),
            // label_padding replaced padding, which files made before it still have alone.
            labelPadding: csvNumber(record.label_padding) ?? csvNumber(record.padding),
            horizontalSpacing: csvNumber(record.horizontal_spacing) ?? 2,
            verticalSpacing: csvNumber(record.vertical_spacing) ?? 2,
            codeType: record.code_type?.trim(),
            showCodeValue: record.show_code_value?.trim() === 'true',
            showBorder: record.show_border?.trim() === 'true'
        });
        if (!preset.success) {
            const fields = preset.error.issues.map((issue) => issue.path.join('.')).join(', ');
            console.warn(
                `⚠️ ${filename}: preset ${index + 1} (${record.name}) skipped, invalid ${fields}`
            );
            continue;
        }
        const blocking = blockingIssues(preset.data);
        if (blocking.length > 0) {
            const codes = blocking.map((issue) => issue.code).join(', ');
            console.warn(
                `⚠️ ${filename}: preset ${index + 1} (${record.name}) skipped, not printable: ${codes}`
            );
            continue;
        }
        // padding: the column that labelPadding replaced, still NOT NULL
        rows.push({ ...preset.data, padding: preset.data.labelPadding });
    }
    if (rows.length === 0) return 0;
    // The names are unique: those already there are kept.
    const { changes } = db.insert(labelPresets).values(rows).onConflictDoNothing().run();
    console.log(`✓ ${filename}: ${changes} added`);
    return changes;
}

/** The default CSV files, each with its importer, in the order the seeding needs. */
const CSV_SEEDS: [string, (db: Tx, filename: string) => unknown][] = [
    [
        'wine_types.csv',
        (db, filename) => importLookupCsv(db, [wineTypes, wineTypes.type], filename)
    ],
    [
        'wine_colors.csv',
        (db, filename) => importLookupCsv(db, [wineColors, wineColors.color], filename)
    ],
    [
        'classification.csv',
        (db, filename) =>
            importLookupCsv(db, [wineClassifications, wineClassifications.name], filename)
    ],
    [
        'wine_formats.csv',
        (db, filename) => importLookupCsv(db, [wineFormats, wineFormats.name], filename)
    ],
    [APPELLATIONS_CSV, importAppellationsCsv],
    [LABEL_PRESETS_CSV, importLabelPresetsCsv]
];

/**
 * The SHA-256 of default files that a later version corrected, with LF line endings (see
 * textHash). A user's copy still identical to one of them was never edited: it gets the corrected
 * file, which a later seeding then reads.
 */
const OUTDATED_DEFAULTS: Record<string, string[]> = {
    // 0.1.0 to 0.11.0: the same rows in Latin-1, which an editor set to UTF-8 garbles
    [APPELLATIONS_CSV]: ['214ee385bba62c0d1fc7e3722ab3fc16a9dcf8c62ad1b556bb40c69ca9daec60'],
    [LABEL_PRESETS_CSV]: [
        // 0.1.0 to 0.8.0: wrong Avery sheets, and five presets too narrow for their barcode
        'bb717ae108eba074008f478d18e00263491d236ced3f3f2ebcd877fa2f0962b0',
        // 0.9.0 to 0.10.0: Avery 8160, an inkjet sheet, described as a laser one
        '853e9bd27c8364f2ae6978fc9ef76ab3531494ac084e891b0106d5d58e32df89'
    ]
};

/**
 * The SHA-256 of `file` with LF line endings: a copy that Windows or another app saved with CRLF
 * ones is still the file that Cellar shipped. Read as Latin-1, byte for byte: decoded as UTF-8, two
 * Latin-1 files that differ by an accented letter would give the same text.
 */
const textHash = (file: string) =>
    createHash('sha256')
        .update(readFileSync(file, 'latin1').replaceAll('\r\n', '\n'))
        .digest('hex');

function isOutdatedDefault(filename: string, file: string): boolean {
    const outdated = OUTDATED_DEFAULTS[filename];
    if (!outdated) return false;
    return outdated.includes(textHash(file));
}

/**
 * Copies to CSV_IMPORTS_DIR the default files that it lacks, so that the user can edit them. A file
 * already there is replaced only when it is an unedited copy of an outdated default: otherwise it
 * may hold the user's edits.
 */
function copyDefaultCsvFiles() {
    for (const [filename] of CSV_SEEDS) {
        const source = path.join(DEFAULT_CSV_DIR, filename);
        const target = path.resolve(CSV_IMPORTS_DIR, filename);
        if (!existsSync(source)) continue;
        const replacing = existsSync(target);
        try {
            if (replacing && !isOutdatedDefault(filename, target)) continue;
            copyFileSync(source, target);
            const action = replacing ? 'Replaced the outdated' : 'Copied the default';
            console.log(`✓ ${action} ${filename} in ${path.resolve(CSV_IMPORTS_DIR)}`);
        } catch (error) {
            // The seeding then reads the file already there, or the default one (see getCsvPath).
            console.warn(`⚠️ Failed to copy ${filename}:`, error);
        }
    }
}

/** Default CSV files could not be imported; the message names them. */
export class SeedingError extends Error {
    constructor(
        message: string,
        /** The files that failed, with their paths. */
        readonly files: string[],
        /** The folder of the user's copies, when one of them failed: fixing it is up to them. */
        readonly userFolder?: string
    ) {
        super(message);
    }
}

const SEEDING_DONE = 'initial_seeding_completed';

/**
 * Copies the default CSV files that CSV_IMPORTS_DIR lacks or holds outdated (copyDefaultCsvFiles),
 * then, on the first start or with `force` (the wipe), inserts the default data that the database
 * lacks and marks the seeding done.
 *
 * Each file goes in its own transaction, and the default settings whatever the files: a broken
 * file, which the user may have edited, only leaves its own lists empty. Throws a SeedingError
 * after the other files when one fails, without marking the seeding done, so that the next start
 * tries again. With `force` the seeding may already be marked done: the caller runs it inside its
 * own transaction, as the wipe does, which then rolls back everything.
 */
export function seed(db: Tx, { force = false } = {}) {
    copyDefaultCsvFiles();
    if (!force && db.select().from(appSettings).where(eq(appSettings.key, SEEDING_DONE)).get()) {
        return;
    }
    console.log('🌱 Seeding the default data from the CSV files...');

    const userCopies = path.resolve(CSV_IMPORTS_DIR);
    const failures = [];
    const failedFiles: string[] = [];
    let userCopyFailed = false;
    for (const [filename, importCsv] of CSV_SEEDS) {
        try {
            db.transaction((tx) => {
                importCsv(tx, filename);
            });
        } catch (error) {
            const csvPath = getCsvPath(filename) ?? filename;
            userCopyFailed ||= path.dirname(csvPath) === userCopies;
            failedFiles.push(csvPath);
            failures.push(`${csvPath} (${error instanceof Error ? error.message : String(error)})`);
        }
    }
    seedDefaultAppSettings(db);
    if (failures.length > 0) {
        // A default file is read only when its copy is missing: the user cannot fix that one.
        const advice = userCopyFailed
            ? ` Fix the files in ${userCopies}, or delete them to get the default files back.`
            : '';
        throw new SeedingError(
            `These CSV files could not be imported: ${failures.join(', ')}.${advice}`,
            failedFiles,
            userCopyFailed ? userCopies : undefined
        );
    }

    db.insert(appSettings).values({ key: SEEDING_DONE, value: 'true' }).onConflictDoNothing().run();
    console.log('✅ Default data seeded');
}

const DEFAULT_SETTINGS = {
    session_timeout_hours: '24',
    barcode_auto_generation: 'true',
    barcode_prefix: 'WINE',
    barcode_start_number: '1',
    auto_backup_enabled: 'true',
    auto_backup_interval: '24',
    auto_backup_keep_count: '7',
    auto_backup_mode: 'internal'
};

/** Inserts the default settings that `db` lacks; those already there keep their value. */
function seedDefaultAppSettings(db: Tx) {
    const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
    db.insert(appSettings).values(rows).onConflictDoNothing().run();
}
