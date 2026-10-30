import { chmodSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    appSettings,
    appellations,
    labelPresets,
    wineClassifications,
    wineColors,
    wineTypes
} from '#lib/server/db/schema.js';
import { failWrites } from '../../../test/failing-write';
import {
    LABEL_PRESETS_0_10_0,
    LABEL_PRESETS_0_8_0,
    locationNames,
    writeUserCsv
} from '../../../test/seed-files';
import { CSV_IMPORTS_DIR, DEFAULT_CSV_DIR } from '#lib/server/paths.js';
import { seed, SeedingError } from './seed';

describe('seed', () => {
    beforeAll(() => seed(db));

    it('fills the reference tables from the default CSV files', async () => {
        const types = await db.select().from(wineTypes);
        expect(types.map((type) => type.type)).toContain('Champagne');
        const classifications = await db.select().from(wineClassifications);
        expect(classifications.map((classification) => classification.name)).toContain(
            'Cinquième Cru Classé'
        );
        // appellations.csv is separated by semicolons.
        const appellationNames = (await db.select().from(appellations)).map(
            (appellation) => appellation.name
        );
        expect(appellationNames).toContain('Côtes du rhône');
        // A quoted field with escaped quotes, and the numbers and booleans read from text.
        expect(await db.select().from(labelPresets)).toContainEqual(
            expect.objectContaining({
                name: 'Avery 5160',
                description: 'Avery 5160 Address Labels (2.625" x 1")',
                pageFormat: 'Letter',
                labelWidth: 66.675,
                labelHeight: 25.4,
                codeType: 'barcode',
                showCodeValue: true
            })
        );
    });

    it('does not import the header line of appellations.csv', async () => {
        const names = await locationNames(db);
        expect(names.countries).not.toContain('Pays');
        expect(names.regions).not.toContain('Région');
        expect(names.appellations).not.toContain('Appellation');
        expect(names.appellations).toContain('Ajaccio'); // the first line after the header
    });

    it('imports the first line of an appellations.csv without a header line', async () => {
        writeUserCsv('appellations.csv', 'Testland;North;First Cru\nTestland;North;Second Cru\n');

        seed(db, { force: true });

        expect((await locationNames(db)).appellations).toEqual(
            expect.arrayContaining(['First Cru', 'Second Cru'])
        );
    });

    // The header of a copy made by hand may differ from the default one (Pays;Région;Appellation).
    it.each([
        [
            'in lower case',
            Buffer.from('pays;région;appellation\nTestland;North;Header Cru\n', 'latin1')
        ],
        ['in English', Buffer.from('Country;Region;Appellation name\nTestland;North;Header Cru\n')],
        [
            'after a UTF-8 BOM',
            // Recognised by its country column alone: AOC is not a usual appellation header.
            Buffer.from('\uFEFFPays;Région;AOC\nTestland;North;Header Cru\n')
        ]
    ])('skips a header line %s in appellations.csv', async (_, content) => {
        writeUserCsv('appellations.csv', content);

        seed(db, { force: true });

        const names = await locationNames(db);
        expect(names.appellations).toContain('Header Cru');
        expect(names.countries.filter((name) => /country|pays/i.test(name))).toEqual([]);
        expect(names.appellations.filter((name) => /^appellation/i.test(name))).toEqual([]);
    });

    // Excel's "CSV UTF-8" starts the file with a byte order mark.
    it('reads a lookup CSV file saved with a UTF-8 BOM', async () => {
        writeUserCsv('wine_colors.csv', '\uFEFFname\nBOM Orange\n');

        expect(() => seed(db, { force: true })).not.toThrow();

        const colors = (await db.select().from(wineColors)).map((color) => color.color);
        expect(colors).toContain('BOM Orange');
    });

    it.each([
        ['UTF-8', 'utf8'],
        ['Latin-1, as 0.11.0 and earlier shipped it', 'latin1']
    ] as const)('reads an appellations.csv saved as %s', async (_, encoding) => {
        writeUserCsv('appellations.csv', Buffer.from('Testland;Rhône;Côtes Test\n', encoding));

        seed(db, { force: true });

        const names = await locationNames(db);
        expect(names.regions).toContain('Rhône');
        expect(names.appellations).toContain('Côtes Test');
    });

    // The API refuses an empty name. A line of spaces is easily left in a file edited by hand.
    it('skips and logs the lines whose names are blank', async () => {
        writeUserCsv('wine_types.csv', 'name\nBlank Test A\n   \nBlank Test B\n');
        writeUserCsv(
            'appellations.csv',
            'Testland;West;Blank Cru\nTestland;;\nTestland;East;  \n ;South;Lost Cru\n'
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());

        seed(db, { force: true });

        const types = (await db.select().from(wineTypes)).map((type) => type.type);
        expect(types).toEqual(expect.arrayContaining(['Blank Test A', 'Blank Test B']));
        const names = await locationNames(db);
        expect(names.regions).toContain('West');
        expect(names.regions).not.toContain('South');
        expect(names.appellations).not.toContain('Lost Cru');
        for (const list of [types, names.countries, names.regions, names.appellations]) {
            expect(list).not.toContain('');
        }
        expect(warn.mock.calls.map(([message]) => message)).toEqual([
            '⚠️ wine_types.csv: line 3 skipped, no name',
            '⚠️ appellations.csv: line 2 skipped, no region, appellation',
            '⚠️ appellations.csv: line 3 skipped, no appellation',
            '⚠️ appellations.csv: line 4 skipped, no country'
        ]);
    });

    // A copy edited by hand: label_presets.csv used to store any page format or code type.
    it('skips the presets of label_presets.csv that the preset API would refuse', async () => {
        const header =
            'name,description,page_format,label_width,label_height,margin_top,margin_left,' +
            'margin_bottom,margin_right,padding,label_padding,horizontal_spacing,' +
            'vertical_spacing,code_type,show_code_value,show_border';
        const row = (name: string, pageFormat: string, codeType: string, width = '50') =>
            `${name},,${pageFormat},${width},30,10,10,10,10,1,1,2,2,${codeType},true,true`;
        writeUserCsv(
            'label_presets.csv',
            [
                header,
                row('Edited A5', 'A5', 'barcode'),
                row('Edited datamatrix', 'A4', 'datamatrix'),
                row('Edited no width', 'A4', 'barcode', ''),
                row('Edited too wide', 'A4', 'qrcode', '400'),
                row('Edited fine', 'A4', 'qrcode')
            ].join('\n')
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());

        seed(db, { force: true });

        const edited = (await db.select().from(labelPresets)).filter((preset) =>
            preset.name.startsWith('Edited')
        );
        expect(edited).toEqual([
            expect.objectContaining({
                name: 'Edited fine',
                codeType: 'qrcode',
                labelPadding: 1,
                padding: 1,
                showBorder: true
            })
        ]);
        expect(warn.mock.calls.map(([message]) => message)).toEqual([
            expect.stringContaining('preset 1 (Edited A5) skipped, invalid pageFormat'),
            expect.stringContaining('preset 2 (Edited datamatrix) skipped, invalid codeType'),
            expect.stringContaining('preset 3 (Edited no width) skipped, invalid labelWidth'),
            expect.stringContaining('preset 4 (Edited too wide) skipped, not printable')
        ]);
    });

    // Earlier versions copied a label_presets.csv into CSV_IMPORTS_DIR that a later one corrected.
    describe('a copy of an outdated default file', () => {
        const SHIPPED = path.join(DEFAULT_CSV_DIR, 'label_presets.csv');
        const withCrlf = (text: string) => text.replaceAll('\n', '\r\n');

        it.each([
            ['0.8.0', LABEL_PRESETS_0_8_0],
            ['0.10.0', LABEL_PRESETS_0_10_0]
        ])('is replaced by the corrected file when the user never edited the %s one', (_, file) => {
            const copy = writeUserCsv('label_presets.csv', readFileSync(file));

            seed(db);

            expect(readFileSync(copy, 'utf8')).toBe(readFileSync(SHIPPED, 'utf8'));
        });

        it('is replaced by the UTF-8 file when the user never edited the Latin-1 appellations.csv', () => {
            const shipped = path.join(DEFAULT_CSV_DIR, 'appellations.csv');
            const latin1 = Buffer.from(readFileSync(shipped, 'utf8'), 'latin1');
            const copy = writeUserCsv('appellations.csv', latin1);

            seed(db);

            expect(readFileSync(copy, 'utf8')).toBe(readFileSync(shipped, 'utf8'));
        });

        // Decoded as UTF-8, the two letters would both read as U+FFFD.
        it('keeps a Latin-1 appellations.csv whose only change is an accented letter', () => {
            const shipped = path.join(DEFAULT_CSV_DIR, 'appellations.csv');
            const edited = readFileSync(shipped, 'utf8').replace(
                'Côtes du rhône',
                'Côtes du rhöne'
            );
            const copy = writeUserCsv('appellations.csv', Buffer.from(edited, 'latin1'));

            seed(db);

            expect(readFileSync(copy, 'latin1')).toBe(edited);
        });

        // Saved again under Windows, or by another app, a copy often gets CRLF line endings.
        it('is replaced when its only change is CRLF line endings', () => {
            const copy = writeUserCsv(
                'label_presets.csv',
                withCrlf(readFileSync(LABEL_PRESETS_0_10_0, 'utf8'))
            );

            seed(db);

            expect(readFileSync(copy, 'utf8')).toBe(readFileSync(SHIPPED, 'utf8'));
        });

        it.each([
            ['LF', (text: string) => text],
            ['CRLF', withCrlf]
        ])('is kept when the user edited it, with %s line endings', (_, lineEndings) => {
            const edited = lineEndings(
                readFileSync(LABEL_PRESETS_0_8_0, 'utf8').replace('11.8', '11.9')
            );
            const copy = writeUserCsv('label_presets.csv', edited);

            seed(db);

            expect(readFileSync(copy, 'utf8')).toBe(edited);
        });
    });

    // A list the user trimmed stays trimmed across restarts; only the wipe brings the rows back.
    it('seeds again only when forced, and never duplicates a row', async () => {
        const counts = async () => ({
            types: (await db.select().from(wineTypes)).length,
            appellations: (await db.select().from(appellations)).length,
            presets: (await db.select().from(labelPresets)).length,
            settings: (await db.select().from(appSettings)).length
        });
        const seeded = await counts();
        await db.delete(wineTypes).where(eq(wineTypes.type, 'Champagne'));

        seed(db);
        expect(await counts()).toEqual({ ...seeded, types: seeded.types - 1 });

        seed(db, { force: true });
        expect(await counts()).toEqual(seeded);
    });

    it('keeps and reads the copy of a default file that the user edited', async () => {
        const editedFile = writeUserCsv('wine_colors.csv', 'name\nOrange\n');

        seed(db, { force: true });

        expect(readFileSync(editedFile, 'utf8')).toBe('name\nOrange\n');
        const colors = (await db.select().from(wineColors)).map((color) => color.color);
        expect(colors).toContain('Orange');
    });

    // Only the user's copies can be fixed or deleted to get the defaults back. Root ignores the
    // read-only folder that makes the copy fail.
    it.skipIf(process.getuid?.() === 0)(
        'names the default file that failed, without telling to fix it',
        async () => {
            await db.delete(wineTypes);
            rmSync(path.join(CSV_IMPORTS_DIR, 'wine_types.csv'));
            // The copy then fails, and the seeding reads the default file.
            chmodSync(CSV_IMPORTS_DIR, 0o555);
            onTestFinished(() => chmodSync(CSV_IMPORTS_DIR, 0o755));
            failWrites('INSERT', 'wine_types', "NEW.type = 'Mousseux'");

            expect(() => seed(db, { force: true })).toThrow(
                new SeedingError(
                    `These CSV files could not be imported: ${path.resolve(DEFAULT_CSV_DIR, 'wine_types.csv')} (Write refused by the test).`,
                    [path.resolve(DEFAULT_CSV_DIR, 'wine_types.csv')]
                )
            );
        }
    );

    // Each file is one transaction: a file that fails halfway leaves none of its rows.
    it('leaves none of the rows of a file that fails, and imports the other files', async () => {
        await db.delete(wineTypes);
        await db.delete(wineColors);
        await db.delete(appSettings).where(eq(appSettings.key, 'initial_seeding_completed'));
        // wine_types.csv lists Vin and Champagne before Mousseux.
        failWrites('INSERT', 'wine_types', "NEW.type = 'Mousseux'");

        expect(() => seed(db)).toThrow(/wine_types\.csv/);

        expect(await db.select().from(wineTypes)).toEqual([]);
        expect(await db.select().from(wineColors)).not.toHaveLength(0);
        const keys = (await db.select().from(appSettings)).map((setting) => setting.key);
        expect(keys).not.toContain('initial_seeding_completed');
    });
});
