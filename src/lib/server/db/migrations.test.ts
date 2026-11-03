import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, migrateSchema } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    labelPresets,
    regions,
    wineDefinitions,
    wineTypes
} from '#lib/server/db/schema.js';
import { migrationsBefore, openOldDatabase } from '../../../test/database';
import { LABEL_PRESETS_0_8_0, locationNames, writeUserCsv } from '../../../test/seed-files';
import { DEFAULT_CSV_DIR } from '#lib/server/paths.js';
import { NEUTRAL_HEX, startingHex } from '#lib/shared/wine-colors.js';
import { seed } from './seed';

type Db = typeof db;

/** SQL inserting the format `bottle` and the wine `margaux`, of the appellation `mgx`. */
const MARGAUX_SQL = `
    INSERT INTO countries VALUES ('fr', 'France', 0, 0);
    INSERT INTO regions VALUES ('bdx', 'Bordeaux', 'fr', 0, 0);
    INSERT INTO appellations VALUES ('mgx', 'Margaux', 'bdx', 0, 0);
    INSERT INTO wine_types VALUES ('still', 'Still', 0, 0);
    INSERT INTO wine_colors VALUES ('red', 'Red', 0, 0);
    INSERT INTO wine_formats VALUES ('bottle', 'Bottle', 0, 0);
    INSERT INTO wine_definitions (id, name, appellation_id, type_id, color_id, created_at, updated_at)
        VALUES ('margaux', 'Château Margaux', 'mgx', 'still', 'red', 0, 0);
`;

describe('migration removing the appellation seeded from the CSV header', () => {
    const TAG = '0004_remove_csv_header_appellation';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    const timestamps = { createdAt: new Date(), updatedAt: new Date() };

    /** A database seeded before the fix: the header line, then a real line of appellations.csv. */
    async function seededBeforeTheFix() {
        const database = openOldDatabase(':memory:', migrationsFolder);
        await database.insert(countries).values([
            { id: 'pays', name: 'Pays', ...timestamps },
            { id: 'fr', name: 'France', ...timestamps }
        ]);
        await database.insert(regions).values([
            { id: 'region', name: 'Région', countryId: 'pays', ...timestamps },
            { id: 'corse', name: 'Corse', countryId: 'fr', ...timestamps }
        ]);
        await database.insert(appellations).values([
            { id: 'appellation', name: 'Appellation', regionId: 'region', ...timestamps },
            { id: 'ajaccio', name: 'Ajaccio', regionId: 'corse', ...timestamps }
        ]);
        return { database, migrateSchema: () => migrateSchema(database) };
    }

    const untouched = {
        countries: ['Pays', 'France'],
        regions: ['Région', 'Corse'],
        appellations: ['Appellation', 'Ajaccio']
    };

    it('removes the three entries when nothing uses them, and only them', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();

        migrateSchema();

        expect(await locationNames(database)).toEqual({
            countries: ['France'],
            regions: ['Corse'],
            appellations: ['Ajaccio']
        });
    });

    it('keeps them when a wine uses the appellation', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        await database.insert(wineTypes).values({ id: 'still', type: 'Still', ...timestamps });
        // In SQL: the colours of older versions have no hex, which Drizzle's insert would give.
        database.$client.exec(
            "INSERT INTO wine_colors (id, color, created_at, updated_at) VALUES ('red', 'Red', 0, 0)"
        );
        await database.insert(wineDefinitions).values({
            id: 'wine',
            name: 'Cuvée',
            appellationId: 'appellation',
            typeId: 'still',
            colorId: 'red',
            ...timestamps
        });

        migrateSchema();

        expect(await locationNames(database)).toEqual(untouched);
    });

    it('keeps them when the region has another appellation', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        await database
            .insert(appellations)
            .values({ id: 'other', name: 'Autre', regionId: 'region', ...timestamps });

        migrateSchema();

        expect(await locationNames(database)).toEqual({
            ...untouched,
            appellations: [...untouched.appellations, 'Autre']
        });
    });

    it('keeps them when the country has another region', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        await database
            .insert(regions)
            .values({ id: 'other', name: 'Autre', countryId: 'pays', ...timestamps });

        migrateSchema();

        expect(await locationNames(database)).toEqual({
            ...untouched,
            regions: [...untouched.regions, 'Autre']
        });
    });

    it('keeps "Pays" and "Région" when they have no "Appellation"', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        await database.delete(appellations).where(eq(appellations.id, 'appellation'));

        migrateSchema();

        expect(await locationNames(database)).toEqual({ ...untouched, appellations: ['Ajaccio'] });
    });

    it('keeps an "Appellation" that is not in the region "Région"', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        await database
            .update(appellations)
            .set({ regionId: 'corse' })
            .where(eq(appellations.id, 'appellation'));

        migrateSchema();

        expect(await locationNames(database)).toEqual(untouched);
    });

    // Drizzle runs a migration once per database; its SQL must still be safe to run again.
    it('changes nothing when run again', async () => {
        const { database, migrateSchema } = await seededBeforeTheFix();
        migrateSchema();
        const afterFirstRun = await locationNames(database);

        database.$client.exec(readFileSync(`drizzle/${TAG}.sql`, 'utf8'));

        expect(await locationNames(database)).toEqual(afterFirstRun);
    });
});

describe('migration filling the spacing of the label presets', () => {
    const TAG = '0005_label_preset_spacing';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    type Spacing = Pick<
        typeof labelPresets.$inferInsert,
        'padding' | 'labelPadding' | 'horizontalSpacing' | 'verticalSpacing'
    >;

    /** The spacing of each preset after the migration, from a database of the previous version. */
    async function migrated(spacings: Record<string, Spacing>) {
        const database = openOldDatabase(':memory:', migrationsFolder);
        // In SQL: a Drizzle insert would name the columns that later migrations add.
        const insert = database.$client.prepare(`
            INSERT INTO label_presets (id, name, page_format, label_width, label_height,
                margin_top, margin_left, margin_bottom, margin_right, padding, label_padding,
                horizontal_spacing, vertical_spacing, code_type, show_code_value, created_at,
                updated_at)
            VALUES (@name, @name, 'A4', 70, 37, 0, 0, 0, 0, @padding, @labelPadding,
                @horizontalSpacing, @verticalSpacing, 'barcode', 1, 0, 0)`);
        for (const [name, spacing] of Object.entries(spacings)) insert.run({ name, ...spacing });
        migrateSchema(database);
        return { database, spacings: await spacingsOf(database) };
    }

    async function spacingsOf(database: Db) {
        const rows = await database.select().from(labelPresets);
        return Object.fromEntries(
            rows.map(({ name, padding, labelPadding, horizontalSpacing, verticalSpacing }) => [
                name,
                { padding, labelPadding, horizontalSpacing, verticalSpacing }
            ])
        );
    }

    const empty = { labelPadding: null, horizontalSpacing: null, verticalSpacing: null };

    it('fills a preset left empty with its padding and a 2 mm gap', async () => {
        const { spacings } = await migrated({ older: { padding: 1.5, ...empty } });

        expect(spacings.older).toEqual({
            padding: 1.5,
            labelPadding: 1.5,
            horizontalSpacing: 2,
            verticalSpacing: 2
        });
    });

    // Every preset of a database where the TypeScript backfill already ran, and the values chosen
    // since, zero included.
    it('keeps the values already set', async () => {
        const chosen = { padding: 1, labelPadding: 0, horizontalSpacing: 3.5, verticalSpacing: 0 };

        const { spacings } = await migrated({ chosen });

        expect(spacings.chosen).toEqual(chosen);
    });

    it('fills only the empty values of a preset', async () => {
        const { spacings } = await migrated({
            partial: { padding: 1, labelPadding: 4, horizontalSpacing: null, verticalSpacing: 1 }
        });

        expect(spacings.partial).toEqual({
            padding: 1,
            labelPadding: 4,
            horizontalSpacing: 2,
            verticalSpacing: 1
        });
    });

    it('changes nothing when run again', async () => {
        const { database, spacings } = await migrated({ older: { padding: 1.5, ...empty } });

        database.$client.exec(readFileSync(`drizzle/${TAG}.sql`, 'utf8'));

        expect(await spacingsOf(database)).toEqual(spacings);
    });
});

describe('migration adding the constraints and indexes', () => {
    const TAG = '0006_constraints_and_indexes';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    /**
     * A database of the previous version holding a wine, `bdx`/`mgx`/`margaux`, a case and a
     * format, and what `sql` adds, which may be anything that version let in. Returns its
     * connection, before the migration.
     */
    function previousVersion(sql: string) {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(`
            ${MARGAUX_SQL}
            INSERT INTO storage_containers VALUES ('rack', 'Rack', NULL, 0, 0);
            INSERT INTO storage_cases VALUES ('rack1', 'Rack1', 6, 'rack', 0, 0);
            ${sql}
        `);
        return database;
    }

    function rows(database: Db, sql: string) {
        return database.$client.prepare(sql).all();
    }

    /** SQL inserting a bottle of the wine margaux. */
    function bottle(
        id: string,
        values: { barcode?: string; availability?: string; notes?: string; createdAt?: number }
    ) {
        const quoted = (value: string | undefined) =>
            value === undefined ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
        return `INSERT INTO wine_bottles (id, definition_id, format_id, barcode, availability, notes, created_at, updated_at)
            VALUES ('${id}', 'margaux', 'bottle', ${quoted(values.barcode)},
                ${quoted(values.availability ?? 'available')}, ${quoted(values.notes)},
                ${values.createdAt ?? 0}, 0);`;
    }

    it('merges the regions of the same name in a country, and then their appellations', () => {
        const database = previousVersion(`
            INSERT INTO countries VALUES ('it', 'Italie', 0, 0);
            INSERT INTO regions VALUES ('bdx2', 'Bordeaux', 'fr', 0, 0), ('bdx-it', 'Bordeaux', 'it', 0, 0);
            -- The oldest is kept, whatever the order of the rows.
            INSERT INTO regions VALUES ('loire-new', 'Loire', 'fr', 2, 2), ('loire-old', 'Loire', 'fr', 1, 1);
            INSERT INTO appellations VALUES
                ('mgx2', 'Margaux', 'bdx2', 0, 0),
                ('pauillac', 'Pauillac', 'bdx2', 0, 0),
                ('mgx3', 'Margaux', 'bdx', 0, 0),
                ('mgx-it', 'Margaux', 'bdx-it', 0, 0);
            INSERT INTO wine_definitions (id, name, appellation_id, type_id, color_id, created_at, updated_at)
                VALUES ('second', 'Second vin', 'mgx2', 'still', 'red', 0, 0),
                       ('third', 'Troisième vin', 'mgx3', 'still', 'red', 0, 0),
                       ('italian', 'Vino', 'mgx-it', 'still', 'red', 0, 0);
        `);

        migrateSchema(database);

        expect(rows(database, 'SELECT id, name, country_id FROM regions ORDER BY id')).toEqual([
            { id: 'bdx', name: 'Bordeaux', country_id: 'fr' },
            { id: 'bdx-it', name: 'Bordeaux', country_id: 'it' },
            { id: 'loire-old', name: 'Loire', country_id: 'fr' }
        ]);
        expect(rows(database, 'SELECT id, region_id FROM appellations ORDER BY id')).toEqual([
            { id: 'mgx', region_id: 'bdx' },
            { id: 'mgx-it', region_id: 'bdx-it' },
            { id: 'pauillac', region_id: 'bdx' }
        ]);
        expect(
            rows(database, 'SELECT id, appellation_id FROM wine_definitions ORDER BY id')
        ).toEqual([
            { id: 'italian', appellation_id: 'mgx-it' },
            { id: 'margaux', appellation_id: 'mgx' },
            { id: 'second', appellation_id: 'mgx' },
            { id: 'third', appellation_id: 'mgx' }
        ]);
    });

    it('leaves a barcode on one bottle, an available one first, and notes it on the others', () => {
        const database = previousVersion(`
            ${bottle('drunk', { barcode: 'CV00000001', availability: 'consumed', notes: 'Birthday' })}
            ${bottle('kept', { barcode: 'CV00000001' })}
            ${bottle('copy', { barcode: 'CV00000001' })}
            ${bottle('newer', { barcode: 'CV00000004', createdAt: 2 })}
            ${bottle('older', { barcode: 'CV00000004', createdAt: 1 })}
            ${bottle('single', { barcode: 'CV00000002' })}
            ${bottle('padded', { barcode: ' CV00000002\t' })}
            ${bottle('trimmed', { barcode: '\tCV00000003 ' })}
            ${bottle('blank', { barcode: '' })}
            ${bottle('spaces', { barcode: ' \t\n' })}
        `);

        migrateSchema(database);

        expect(
            rows(database, 'SELECT id, barcode, notes FROM wine_bottles ORDER BY rowid')
        ).toEqual([
            {
                id: 'drunk',
                barcode: null,
                notes: 'Birthday\nBarcode CV00000001 removed in the Cellar upgrade: another bottle has it.'
            },
            { id: 'kept', barcode: 'CV00000001', notes: null },
            {
                id: 'copy',
                barcode: null,
                notes: 'Barcode CV00000001 removed in the Cellar upgrade: another bottle has it.'
            },
            {
                id: 'newer',
                barcode: null,
                notes: 'Barcode CV00000004 removed in the Cellar upgrade: another bottle has it.'
            },
            { id: 'older', barcode: 'CV00000004', notes: null },
            { id: 'single', barcode: 'CV00000002', notes: null },
            {
                id: 'padded',
                barcode: null,
                notes: 'Barcode CV00000002 removed in the Cellar upgrade: another bottle has it.'
            },
            { id: 'trimmed', barcode: 'CV00000003', notes: null },
            { id: 'blank', barcode: null, notes: null },
            { id: 'spaces', barcode: null, notes: null }
        ]);
    });

    it('gives each bottle one of the three statuses, and notes the status it replaces', () => {
        const database = previousVersion(`
            ${bottle('upper', { availability: 'Available' })}
            ${bottle('spaced', { availability: ' consumed\t' })}
            ${bottle('empty', { availability: '' })}
            ${bottle('sold', { availability: 'sold', notes: 'To Paul' })}
            ${bottle('left', { availability: 'out_of_cellar' })}
        `);

        migrateSchema(database);

        expect(
            rows(database, 'SELECT id, availability, notes FROM wine_bottles ORDER BY rowid')
        ).toEqual([
            { id: 'upper', availability: 'available', notes: null },
            { id: 'spaced', availability: 'consumed', notes: null },
            { id: 'empty', availability: 'available', notes: null },
            {
                id: 'sold',
                availability: 'out_of_cellar',
                notes: 'To Paul\nStatus "sold" replaced by "out_of_cellar" in the Cellar upgrade.'
            },
            { id: 'left', availability: 'out_of_cellar', notes: null }
        ]);
    });

    it('keeps the ratings from 1 to 5, and notes the others in the description', () => {
        const wine = (id: string, rating: string, description = 'NULL') =>
            `INSERT INTO wine_definitions (id, name, appellation_id, type_id, color_id, rating, description, created_at, updated_at)
                VALUES ('${id}', '${id}', 'mgx', 'still', 'red', ${rating}, ${description}, 0, 0);`;
        const database = previousVersion(`
            ${wine('half', '4.5')}
            ${wine('top', '5')}
            ${wine('zero', '0')}
            ${wine('ten', '10', "'Bought in Lyon'")}
            ${wine('negative', '-1')}
            ${wine('word', "'five'")}
        `);

        migrateSchema(database);

        expect(
            rows(
                database,
                "SELECT id, rating, description FROM wine_definitions WHERE id <> 'margaux' ORDER BY rowid"
            )
        ).toEqual([
            { id: 'half', rating: 4.5, description: null },
            { id: 'top', rating: 5, description: null },
            { id: 'zero', rating: null, description: null },
            {
                id: 'ten',
                rating: null,
                description:
                    'Bought in Lyon\nRating 10 removed in the Cellar upgrade: ratings go from 1 to 5.'
            },
            {
                id: 'negative',
                rating: null,
                description: 'Rating -1 removed in the Cellar upgrade: ratings go from 1 to 5.'
            },
            {
                id: 'word',
                rating: null,
                description: 'Rating five removed in the Cellar upgrade: ratings go from 1 to 5.'
            }
        ]);
    });

    it('drops a parent container that does not exist, and keeps the others', () => {
        const database = previousVersion(`
            INSERT INTO storage_containers VALUES
                ('shelf', 'Shelf', 'rack', 0, 0),
                ('orphan', 'Orphan', 'Rack', 0, 0);
        `);

        migrateSchema(database);

        expect(
            rows(database, 'SELECT id, parent_container_id FROM storage_containers ORDER BY rowid')
        ).toEqual([
            { id: 'rack', parent_container_id: null },
            { id: 'shelf', parent_container_id: 'rack' },
            { id: 'orphan', parent_container_id: null }
        ]);
    });

    // The tables are recreated: the rows that refer to them must keep their links.
    it('keeps the bottles in their cases and the wines with their images', () => {
        const database = previousVersion(`
            INSERT INTO wine_images VALUES ('label', 'label.png', '/uploads/wines/', 0, 0);
            UPDATE wine_definitions SET image_id = 'label';
            ${bottle('stored', { barcode: 'CV00000001' })}
            UPDATE wine_bottles SET storage_case_id = 'rack1';
        `);
        const before = rows(database, 'SELECT * FROM wine_bottles');

        migrateSchema(database);

        // Matched rather than equal: the columns of later migrations come in too.
        expect(rows(database, 'SELECT * FROM wine_bottles')).toMatchObject(before);
        expect(rows(database, 'SELECT image_id FROM wine_definitions')).toEqual([
            { image_id: 'label' }
        ]);
    });

    it('then refuses what it repaired, and unlinks the bottles and wines of what is deleted', () => {
        const database = previousVersion(`
            INSERT INTO wine_images VALUES ('label', 'label.png', '/uploads/wines/', 0, 0);
            UPDATE wine_definitions SET image_id = 'label';
            ${bottle('stored', { barcode: 'CV00000001', availability: 'out_of_cellar' })}
            UPDATE wine_bottles SET storage_case_id = 'rack1';
        `);
        migrateSchema(database);
        const sqlite = database.$client;

        expect(() => sqlite.exec(bottle('twin', { barcode: 'CV00000001' }))).toThrow(/UNIQUE/);
        expect(() => sqlite.exec(bottle('sold', { availability: 'sold' }))).toThrow(/CHECK/);
        expect(() => sqlite.exec('UPDATE wine_definitions SET rating = 6')).toThrow(/CHECK/);
        expect(() =>
            sqlite.exec("INSERT INTO regions VALUES ('bdx2', 'Bordeaux', 'fr', 0, 0)")
        ).toThrow(/UNIQUE/);
        expect(() =>
            sqlite.exec("INSERT INTO appellations VALUES ('mgx2', 'Margaux', 'bdx', 0, 0)")
        ).toThrow(/UNIQUE/);
        expect(() =>
            sqlite.exec("UPDATE storage_containers SET parent_container_id = 'gone'")
        ).toThrow(/FOREIGN KEY/);
        sqlite.exec(`${bottle('none', {})} ${bottle('nothing', {})}`);

        sqlite.exec('DELETE FROM storage_cases; DELETE FROM wine_images;');

        expect(
            rows(database, "SELECT storage_case_id FROM wine_bottles WHERE id = 'stored'")
        ).toEqual([{ storage_case_id: null }]);
        expect(rows(database, 'SELECT image_id FROM wine_definitions')).toEqual([
            { image_id: null }
        ]);
    });
});

describe('migration giving each case its position', () => {
    const TAG = '0007_case_position';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    /** The cases of each container in the order of their positions. */
    function positions(database: Db) {
        return database.$client
            .prepare(
                'SELECT container_id, name, position FROM storage_cases ORDER BY container_id, position'
            )
            .all() as { container_id: string; name: string; position: number }[];
    }

    /** A database of the previous version holding what `sql` adds, after the migration. */
    function migratedOrder(sql: string) {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(sql);
        migrateSchema(database);
        return { database, rows: positions(database) };
    }

    const cases = (container: string, names: string[]) =>
        names
            .map(
                (name) =>
                    `INSERT INTO storage_cases VALUES ('${container}-${name}', '${name}', 6, '${container}', 0, 0);`
            )
            .join('\n');

    // Inserted out of order: the order of earlier versions comes from the names, not the rows.
    const earlierData = `
        INSERT INTO storage_containers VALUES ('a', 'A', NULL, 0, 0), ('a1', 'A1', NULL, 0, 0),
            ('box', 'Box Z', NULL, 0, 0), ('old', 'Column C', NULL, 0, 0);
        ${cases('a', ['A10', 'A2', 'A11', 'A1', 'A9'])}
        ${cases('a1', ['A12', 'A11'])}
        ${cases('box', ['Box Z top', 'Box Z'])}
        ${cases('old', ['C2', 'C01', 'C1'])}
    `;

    it('keeps the order the storage page showed: by the number ending the name, then by name', () => {
        const { rows } = migratedOrder(earlierData);

        const order = (container: string) =>
            rows
                .filter((row) => row.container_id === container)
                .map((row) => [row.position, row.name]);
        expect(order('a')).toEqual([
            [0, 'A1'],
            [1, 'A2'],
            [2, 'A9'],
            [3, 'A10'],
            [4, 'A11']
        ]);
        // A1 + 11 and A + 11 are both named A11, but each keeps its own container and place.
        expect(order('a1')).toEqual([
            [0, 'A11'],
            [1, 'A12']
        ]);
        // No number: 0, then by name.
        expect(order('box')).toEqual([
            [0, 'Box Z'],
            [1, 'Box Z top']
        ]);
        // 01 is 1, as parseInt read it; the name breaks the tie.
        expect(order('old')).toEqual([
            [0, 'C01'],
            [1, 'C1'],
            [2, 'C2']
        ]);
    });

    it('keeps the bottles in their cases', () => {
        const { database } = migratedOrder(`
            ${earlierData}
            ${MARGAUX_SQL}
            INSERT INTO wine_bottles (id, definition_id, format_id, storage_case_id, availability, created_at, updated_at)
                VALUES ('one', 'margaux', 'bottle', 'a-A11', 'available', 0, 0),
                    ('two', 'margaux', 'bottle', 'a1-A11', 'available', 0, 0);
        `);

        expect(
            database.$client
                .prepare('SELECT id, storage_case_id FROM wine_bottles ORDER BY id')
                .all()
        ).toEqual([
            { id: 'one', storage_case_id: 'a-A11' },
            { id: 'two', storage_case_id: 'a1-A11' }
        ]);
    });

    it('gives the same positions when its update runs again', () => {
        const { database, rows } = migratedOrder(earlierData);
        const [, update] = readFileSync(`drizzle/${TAG}.sql`, 'utf8').split(
            '--> statement-breakpoint'
        );

        database.$client.exec(update);

        expect(positions(database)).toEqual(rows);
    });
});

describe('migration saving the label border of the presets', () => {
    const TAG = '0008_label_preset_show_border';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    it('keeps every field of the presets, and turns their border off', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(`
            INSERT INTO label_presets (id, name, description, page_format, label_width,
                label_height, margin_top, margin_left, margin_bottom, margin_right, padding,
                label_padding, horizontal_spacing, vertical_spacing, code_type, show_code_value,
                created_at, updated_at)
            VALUES ('bistro', 'Bistro', 'Made up', 'Letter', 70, 37, 8.5, 0, 8.5, 0, 1.5, 1.5,
                0, 3.2, 'qrcode', 0, 1791917425, 1791917426)`);
        const presets = () => database.$client.prepare('SELECT * FROM label_presets').all();
        const before = presets();

        migrateSchema(database);

        expect(presets()).toEqual([{ ...(before[0] as object), show_border: 0 }]);
    });
});

describe('migration fixing the shipped label presets', () => {
    const TAG = '0009_fix_shipped_label_presets';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    // The rows of label_presets.csv that 0.1.0 to 0.8.0 shipped wrong: those that it changed since.
    const SHIPPED_BEFORE = (() => {
        const [header, ...rows] = readFileSync(LABEL_PRESETS_0_8_0, 'utf8').split('\n');
        const current = readFileSync(path.join(DEFAULT_CSV_DIR, 'label_presets.csv'), 'utf8');
        return [header, ...rows.filter((row) => !current.split('\n').includes(row))].join('\n');
    })();

    /** The presets of `database` by name, without the fields that differ between databases. */
    function presetsOf(database: Db) {
        return Object.fromEntries(
            database
                .select()
                .from(labelPresets)
                .all()
                .map((preset) => {
                    const fields: Partial<typeof preset> = { ...preset };
                    delete fields.id;
                    delete fields.createdAt;
                    delete fields.updatedAt;
                    return [preset.name, fields];
                })
        );
    }

    // What the user may change in a preset without changing its measures.
    const CHOICES: Record<string, Partial<typeof labelPresets.$inferSelect>> = {
        'Avery 5163': { showBorder: true },
        'Avery 5164': { description: 'Shelf labels' },
        'Zebra 2x1': { showCodeValue: false }
    };

    /**
     * A database of 0.8.0 seeded with the presets shipped then, Avery 5160 changed by the user and
     * others given the CHOICES, then migrated; and the presets of a new installation.
     */
    function upgraded() {
        const fresh = openOldDatabase(':memory:', 'drizzle');
        seed(fresh);
        const database = openOldDatabase(':memory:', migrationsFolder);
        // seed() now leaves aside the presets that the PDF refuses, which 0.8.0 seeded: they go
        // in as QR codes, then turn back into the barcodes they were.
        writeUserCsv('label_presets.csv', SHIPPED_BEFORE.replaceAll(',barcode,', ',qrcode,'));
        // The colours of 0.8.0 have no hex, which seed() now gives them: the presets need none.
        writeUserCsv('wine_colors.csv', 'name\n');
        seed(database);
        database.update(labelPresets).set({ codeType: 'barcode' }).run();
        for (const [name, choice] of Object.entries(CHOICES)) {
            database.update(labelPresets).set(choice).where(eq(labelPresets.name, name)).run();
        }
        database
            .update(labelPresets)
            .set({ marginTop: 13 })
            .where(eq(labelPresets.name, 'Avery 5160'))
            .run();
        const changed = presetsOf(database)['Avery 5160'];
        migrateSchema(database);
        return { database, changed, shipped: presetsOf(fresh) };
    }

    it('gives the presets of unchanged measures those of a new installation, and keeps the rest', () => {
        const { database, shipped } = upgraded();
        const unchanged = presetsOf(database);
        delete unchanged['Avery 5160'];

        expect(Object.keys(unchanged)).toHaveLength(10);
        expect(unchanged).toEqual(
            Object.fromEntries(
                Object.keys(unchanged).map((name) => [name, { ...shipped[name], ...CHOICES[name] }])
            )
        );
    });

    it('keeps a preset that the user changed', () => {
        const { database, changed } = upgraded();

        expect(presetsOf(database)['Avery 5160']).toEqual(changed);
        expect(changed).toMatchObject({ marginTop: 13, verticalSpacing: 2 });
    });

    // Drizzle runs a migration once per database; its SQL must still be safe to run again.
    it('changes nothing when run again', () => {
        const { database } = upgraded();
        const afterFirstRun = presetsOf(database);

        database.$client.exec(readFileSync(`drizzle/${TAG}.sql`, 'utf8'));

        expect(presetsOf(database)).toEqual(afterFirstRun);
    });
});

describe('migration storing a vintage of 0 as no vintage', () => {
    const TAG = '0010_vintage_zero_as_null';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    it('gives the bottles of vintage 0 no vintage, and keeps the other vintages and the optimum', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(`
            ${MARGAUX_SQL}
            INSERT INTO wine_bottles (id, definition_id, format_id, vintage, optimum, availability, created_at, updated_at)
                VALUES ('zero', 'margaux', 'bottle', 0, 0, 'available', 0, 0),
                    ('dated', 'margaux', 'bottle', 2015, 2030, 'available', 0, 0),
                    ('none', 'margaux', 'bottle', NULL, NULL, 'available', 0, 0);
        `);

        migrateSchema(database);

        expect(
            database.$client
                .prepare('SELECT id, vintage, optimum FROM wine_bottles ORDER BY id')
                .all()
        ).toEqual([
            { id: 'dated', vintage: 2015, optimum: 2030 },
            { id: 'none', vintage: null, optimum: null },
            { id: 'zero', vintage: null, optimum: 0 }
        ]);
    });
});

describe('migration cutting the notes and descriptions to 5,000 characters', () => {
    const TAG = '0011_long_texts_to_5000_characters';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    it('cuts the longer ones to their first 5,000 characters, and keeps the rest of each row', () => {
        const long = `${'a'.repeat(4_999)}bc`;
        const full = 'f'.repeat(5_000);
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(`
            ${MARGAUX_SQL}
            INSERT INTO wine_definitions (id, name, producer, description, appellation_id, type_id, color_id, created_at, updated_at)
                VALUES ('long', 'Long', 'Taylor', '${long}', 'mgx', 'still', 'red', 0, 0),
                    ('full', 'Full', 'Dow', '${full}', 'mgx', 'still', 'red', 0, 0);
            INSERT INTO wine_bottles (id, definition_id, format_id, vintage, notes, barcode, availability, created_at, updated_at)
                VALUES ('long', 'margaux', 'bottle', 2015, '${long}', 'B1', 'available', 0, 0),
                    ('full', 'margaux', 'bottle', 2016, '${full}', 'B2', 'consumed', 0, 0),
                    ('none', 'margaux', 'bottle', NULL, NULL, NULL, 'available', 0, 0);
        `);
        const rows = () => ({
            wines: database.$client.prepare('SELECT * FROM wine_definitions ORDER BY id').all(),
            bottles: database.$client.prepare('SELECT * FROM wine_bottles ORDER BY id').all()
        });
        const before = rows();

        migrateSchema(database);

        const cut = `${'a'.repeat(4_999)}b`;
        const withCut = <Row extends { id: unknown }>(list: Row[], column: string) =>
            list.map((row) => (row.id === 'long' ? { ...row, [column]: cut } : row));
        // Matched rather than equal: the columns of later migrations come in too.
        expect(rows()).toMatchObject({
            wines: withCut(before.wines as { id: unknown }[], 'description'),
            bottles: withCut(before.bottles as { id: unknown }[], 'notes')
        });
    });

    // Earlier forms stored CRLF line breaks, which the app counts as one character; SQLite
    // counts an emoji as one character, where the app counts two.
    it('gives every text LF line breaks, then counts an emoji as SQLite does', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(MARGAUX_SQL);
        const insert = database.$client.prepare(
            `INSERT INTO wine_bottles (id, definition_id, format_id, notes, availability, created_at, updated_at)
                VALUES (?, 'margaux', 'bottle', ?, 'available', 0, 0)`
        );
        const fits = `${'a'.repeat(2_500)}\r\n${'b'.repeat(2_499)}`;
        insert.run('fits', fits);
        insert.run('long', `${'a'.repeat(3_000)}\r\n${'b'.repeat(3_000)}`);
        insert.run('emoji', `🍷${'a'.repeat(5_000)}`);
        database.$client.exec(
            `UPDATE wine_definitions SET description = 'Nose\r\nPalate' WHERE id = 'margaux'`
        );

        migrateSchema(database);

        const notes = database.$client
            .prepare('SELECT id, notes FROM wine_bottles ORDER BY id')
            .all();
        expect(notes).toEqual([
            { id: 'emoji', notes: `🍷${'a'.repeat(4_999)}` },
            { id: 'fits', notes: fits.replace('\r\n', '\n') },
            { id: 'long', notes: `${'a'.repeat(3_000)}\n${'b'.repeat(1_999)}` }
        ]);
        expect(
            database.$client.prepare('SELECT description FROM wine_definitions').pluck().get()
        ).toBe('Nose\nPalate');
    });
});

describe('migration describing Avery 8160 as an inkjet sheet', () => {
    const TAG = '0012_fix_avery_8160_description';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    const LASER = 'Avery 8160 Address Labels (2.625" x 1") - Laser';

    /** A database of 0.10.0 with the presets `[id, name, description]`, then migrated. */
    function upgraded(presets: [string, string, string][]) {
        const database = openOldDatabase(':memory:', migrationsFolder);
        const insert = database.$client.prepare(`
            INSERT INTO label_presets (id, name, description, page_format, label_width,
                label_height, margin_top, margin_left, margin_bottom, margin_right, padding,
                label_padding, horizontal_spacing, vertical_spacing, code_type, show_code_value,
                show_border, created_at, updated_at)
            VALUES (?, ?, ?, 'Letter', 66.675, 25.4, 12.7, 4.7625, 12.7, 4.7625, 1, 1, 3.175, 0,
                'barcode', 1, 0, 0, 0)`);
        for (const preset of presets) insert.run(...preset);
        migrateSchema(database);
        return database;
    }

    const descriptions = (database: Db) =>
        database.$client.prepare('SELECT id, description FROM label_presets ORDER BY id').all();

    it('corrects the description that Cellar shipped, and only that one', () => {
        const database = upgraded([
            ['shipped', 'Avery 8160', LASER],
            ['copy', 'Avery 8160 copy', LASER]
        ]);

        expect(descriptions(database)).toEqual([
            { id: 'copy', description: LASER },
            { id: 'shipped', description: 'Avery 8160 Address Labels (2.625" x 1") - Inkjet' }
        ]);
    });

    it('keeps a description that the user wrote', () => {
        const database = upgraded([['edited', 'Avery 8160', 'Kitchen shelf']]);

        expect(descriptions(database)).toEqual([{ id: 'edited', description: 'Kitchen shelf' }]);
    });
});

describe('migration renaming the duplicate container and case names', () => {
    const TAG = '0013_rename_duplicate_storage_names';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    // Two containers "A", the second created later, and a container already named "A (2)"; the
    // first "A" has two cases "A1". A bottle in each case.
    const DUPLICATES_SQL = `
        ${MARGAUX_SQL}
        INSERT INTO storage_containers (id, name, created_at, updated_at)
            VALUES ('newer', 'A', 200, 200), ('older', 'A', 100, 100), ('taken', 'A (2)', 50, 50);
        INSERT INTO storage_cases (id, name, capacity, container_id, position, created_at, updated_at)
            VALUES ('older-a1', 'A1', 6, 'older', 0, 100, 100),
                ('older-a1-again', 'A1', 6, 'older', 1, 300, 300),
                ('older-a2', 'A2', 6, 'older', 2, 100, 100),
                ('newer-a1', 'A1', 6, 'newer', 0, 200, 200),
                ('newer-top', 'Top', 6, 'newer', 1, 200, 200),
                ('taken-1', 'A (2)1', 6, 'taken', 0, 50, 50);
        INSERT INTO wine_bottles (id, definition_id, format_id, storage_case_id, availability, created_at, updated_at)
            SELECT 'in-' || id, 'margaux', 'bottle', id, 'available', 0, 0 FROM storage_cases;
    `;

    function migrated(sql: string) {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(sql);
        migrateSchema(database);
        const all = (query: string) => database.$client.prepare(query).all();
        return {
            database,
            containers: all('SELECT id, name FROM storage_containers ORDER BY id'),
            cases: all('SELECT id, name, container_id FROM storage_cases ORDER BY id'),
            bottles: all('SELECT id, storage_case_id FROM wine_bottles ORDER BY id')
        };
    }

    it('renames the newer duplicates to the first free number, and keeps every bottle in its case', () => {
        const { containers, cases, bottles } = migrated(DUPLICATES_SQL);

        expect(containers).toEqual([
            { id: 'newer', name: 'A (3)' },
            { id: 'older', name: 'A' },
            { id: 'taken', name: 'A (2)' }
        ]);
        expect(cases).toEqual([
            // A case named after the renamed container follows it; the others keep their name.
            { id: 'newer-a1', name: 'A (3)1', container_id: 'newer' },
            { id: 'newer-top', name: 'Top', container_id: 'newer' },
            { id: 'older-a1', name: 'A1', container_id: 'older' },
            { id: 'older-a1-again', name: 'A1 (2)', container_id: 'older' },
            { id: 'older-a2', name: 'A2', container_id: 'older' },
            { id: 'taken-1', name: 'A (2)1', container_id: 'taken' }
        ]);
        expect(bottles).toEqual(
            (cases as { id: string }[]).map(({ id }) => ({ id: `in-${id}`, storage_case_id: id }))
        );
    });

    it('then refuses a second container or case of the same name', () => {
        const { database } = migrated(DUPLICATES_SQL);

        expect(() =>
            database.$client.exec(
                `INSERT INTO storage_containers (id, name, created_at, updated_at) VALUES ('x', 'A', 0, 0)`
            )
        ).toThrow(/UNIQUE constraint failed: storage_containers.name/);
        expect(() =>
            database.$client.exec(
                `INSERT INTO storage_cases (id, name, capacity, container_id, created_at, updated_at)
                    VALUES ('y', 'A2', 6, 'older', 0, 0)`
            )
        ).toThrow(/UNIQUE constraint failed: storage_cases.container_id, storage_cases.name/);
    });

    it('changes nothing in a cellar without duplicates', () => {
        const sql = `
            INSERT INTO storage_containers (id, name, created_at, updated_at)
                VALUES ('a', 'A', 100, 100), ('b', 'a', 100, 100);
            INSERT INTO storage_cases (id, name, capacity, container_id, created_at, updated_at)
                VALUES ('a1', 'A1', 6, 'a', 100, 100), ('b1', 'A1', 6, 'b', 100, 100);
        `;
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(sql);
        const rows = () =>
            database.$client
                .prepare(
                    'SELECT * FROM storage_containers JOIN storage_cases ON container_id = storage_containers.id'
                )
                .all();
        const before = rows();

        migrateSchema(database);

        expect(rows()).toEqual(before);
    });
});

describe('migration removing the negative prices and values', () => {
    const TAG = '0015_repair_negative_prices';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    it('moves each negative price or value into the notes, and keeps the rest of each row', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(`
            ${MARGAUX_SQL}
            INSERT INTO wine_bottles (id, definition_id, format_id, vintage, purchase_price, purchase_date, current_value, current_value_date, notes, barcode, availability, created_at, updated_at)
                VALUES ('both', 'margaux', 'bottle', 2015, -5, 100, -12.5, 200, 'Gift', 'B1', 'consumed', 0, 0),
                    ('price', 'margaux', 'bottle', 2016, -1, NULL, 30, NULL, NULL, NULL, 'available', 0, 0),
                    ('value', 'margaux', 'bottle', NULL, 0, NULL, -0.5, NULL, '', NULL, 'available', 0, 0),
                    ('kept', 'margaux', 'bottle', NULL, 12.5, NULL, 0, NULL, 'Kept', NULL, 'available', 0, 0),
                    ('none', 'margaux', 'bottle', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'available', 0, 0);
        `);
        const rows = () =>
            database.$client.prepare('SELECT * FROM wine_bottles ORDER BY id').all() as {
                id: string;
            }[];
        const before = rows();

        migrateSchema(database);

        const price = (amount: string) =>
            `Purchase price ${amount} removed in the Cellar upgrade: prices are 0 or more.`;
        const value = (amount: string) =>
            `Current value ${amount} removed in the Cellar upgrade: values are 0 or more.`;
        const repairs: Record<string, object> = {
            both: {
                purchase_price: null,
                current_value: null,
                notes: `Gift\n${price('-5')}\n${value('-12.5')}`
            },
            price: { purchase_price: null, notes: price('-1') },
            value: { current_value: null, notes: value('-0.5') }
        };
        // Matched rather than equal: the columns of later migrations come in too.
        expect(rows()).toMatchObject(before.map((row) => ({ ...row, ...repairs[row.id] })));
    });

    // Notes hold 5,000 characters at most since 0.10.0 (migration 0011): they are cut after the
    // repair, as an import does.
    it('cuts the notes that the added line makes longer than 5,000 characters', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        database.$client.exec(MARGAUX_SQL);
        const insert = database.$client.prepare(
            `INSERT INTO wine_bottles (id, definition_id, format_id, purchase_price, notes, availability, created_at, updated_at)
                VALUES (?, 'margaux', 'bottle', -2, ?, 'available', 0, 0)`
        );
        insert.run('full', 'f'.repeat(5_000));
        insert.run('near', 'n'.repeat(4_991));

        migrateSchema(database);

        expect(
            database.$client
                .prepare('SELECT id, purchase_price, notes FROM wine_bottles ORDER BY id')
                .all()
        ).toEqual([
            { id: 'full', purchase_price: null, notes: 'f'.repeat(5_000) },
            { id: 'near', purchase_price: null, notes: `${'n'.repeat(4_991)}\nPurchase` }
        ]);
    });
});

describe('migration giving the wine colours their colour value', () => {
    const TAG = '0018_wine_color_hex';
    let migrationsFolder = '';
    beforeAll(() => {
        migrationsFolder = migrationsBefore(TAG);
    });
    afterAll(() => rmSync(migrationsFolder, { recursive: true, force: true }));

    // The seeded names, translated or written otherwise, and colours the user made.
    const NAMES = [
        'Rouge',
        'Blanc',
        'Rosé',
        'Jaune',
        'N/A',
        'red',
        ' WHITE ',
        'ROSÉ',
        'rose',
        'Yellow',
        'Orange',
        'Effervescent'
    ];

    it('gives each colour the one that startingHex gives its name, the neutral grey to the others', () => {
        const database = openOldDatabase(':memory:', migrationsFolder);
        const insert = database.$client.prepare('INSERT INTO wine_colors VALUES (?, ?, 0, 0)');
        NAMES.forEach((name, index) => insert.run(`c${index}`, name));

        migrateSchema(database);

        const rows = database.$client
            .prepare('SELECT color, hex FROM wine_colors ORDER BY rowid')
            .all() as { color: string; hex: string }[];
        expect(rows).toEqual(NAMES.map((name) => ({ color: name, hex: startingHex(name) })));
        expect(rows.find((row) => row.color === 'Orange')?.hex).toBe(NEUTRAL_HEX);
        expect(rows.find((row) => row.color === 'ROSÉ')?.hex).toBe(startingHex('Rosé'));
        expect(new Set(rows.map((row) => row.hex)).size).toBe(5);
    });
});
