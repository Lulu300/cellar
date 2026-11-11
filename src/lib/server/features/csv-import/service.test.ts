import { describe, expect, it } from 'vitest';
import { csvImportTables } from './service';

describe('csvImportTables', () => {
    const tables = csvImportTables();
    const table = (name: string) => tables.find((config) => config.table === name)!;
    const required = (name: string) => ({ name, required: true });
    const optional = (name: string) => ({ name, required: false });

    it('lists the tables in the order of the import, each after those it refers to', () => {
        const priorities = tables.map(({ priority }) => priority);

        expect(priorities).toEqual(priorities.toSorted((a, b) => a - b));
        expect(tables.map(({ table }) => table)).toHaveLength(14);
        expect(table('appellations').priority).toBeGreaterThan(table('regions').priority);
        expect(table('wineBottles').priority).toBe(5);
    });

    it('gives the columns that the import reads, with the names of the rows they refer to', () => {
        expect(table('countries').columns).toEqual([required('name')]);
        expect(table('appellations').columns).toEqual([
            required('name'),
            required('regionName'),
            optional('countryName')
        ]);
        // The country of a producer is also that of its region: it comes once.
        expect(table('producers').columns).toEqual([
            required('name'),
            optional('countryName'),
            optional('regionName'),
            optional('website'),
            optional('contact'),
            optional('description'),
            optional('imageName')
        ]);
        expect(table('wineDefinitions').columns.filter(({ name }) => name === 'producer')).toEqual([
            optional('producer')
        ]);
        // The parent of a container is an id, which a file never gives.
        expect(table('storageContainers').columns).toEqual([required('name')]);
        expect(table('wineBottles').columns).toEqual(
            expect.arrayContaining([
                required('wineName'),
                optional('producer'),
                required('formatName'),
                optional('barcode')
            ])
        );
        expect(table('wineBottles').columns[0]).toEqual(required('wineName'));
    });
});
