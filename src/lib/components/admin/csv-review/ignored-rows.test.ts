import { describe, expect, it } from 'vitest';
import type { CsvImportDTO } from '#lib/shared/dto.js';
import { ignoredRowsCsv, ignoredRowsFileName } from './ignored-rows';

type FileReport = CsvImportDTO['results'][number];
type Review = NonNullable<CsvImportDTO['review']>;

const key = JSON.stringify(['cell', 'wineBottles', 'vintage', '2O21']);
const report = {
    table: 'wineBottles',
    file: 'cave-wineBottles.csv',
    columns: ['wineName', 'vintage', 'notes'],
    ignored: [
        { row: 2, key, values: ['Sancerre, blanc', '2O21', '=HYPERLINK("x")'] },
        { row: 5, key: 'unlisted', values: ['Chinon', '2019', ''] }
    ]
} as unknown as FileReport;
const review = {
    issues: [
        {
            key,
            kind: 'cell',
            column: 'vintage',
            value: '2O21',
            open: false,
            problem: { code: 'invalid', column: 'vintage' }
        }
    ]
} as unknown as Review;

describe('ignoredRowsCsv', () => {
    it('gives back the rows as read, with why each was ignored last', () => {
        const csv = ignoredRowsCsv(report, review, ',');
        const [header, first, second] = csv.split('\n');

        expect(header).toMatch(/^wineName,vintage,notes,\w+$/);
        // Quoted where needed, and a formula guarded, as the CSV export writes them.
        expect(first).toMatch(/^"Sancerre, blanc",2O21,"'=HYPERLINK\(""x""\)",.*2O21/);
        // A row whose issue was not listed has an empty reason.
        expect(second).toBe('Chinon,2019,,');
        expect(csv.endsWith('\n')).toBe(true);
    });

    it('writes with the delimiter of the import', () => {
        expect(ignoredRowsCsv(report, review, ';').split('\n')[2]).toBe('Chinon;2019;;');
    });
});

describe('ignoredRowsFileName', () => {
    it('names the file after the one imported', () => {
        expect(ignoredRowsFileName('cave-wineBottles.csv')).toBe('cave-wineBottles-ignored.csv');
        expect(ignoredRowsFileName('BOTTLES.CSV')).toBe('BOTTLES-ignored.csv');
    });
});
