import { m } from '#lib/paraglide/messages.js';
import type { CsvTable } from '#lib/shared/dto.js';

/**
 * The words of the admin page for each table that the CSV export writes and the import reads, in
 * the order the export lists them; the server gives the rest, such as the columns of the import.
 * `note` tells how the import treats the rows of a table, when that needs saying.
 */
export const CSV_TABLE_TEXTS: Record<
    CsvTable,
    { label: () => string; description: () => string; note?: () => string }
> = {
    countries: { label: m['admin.countries'], description: m['admin.csv_table_countries'] },
    regions: { label: m['admin.regions'], description: m['admin.csv_table_regions'] },
    appellations: {
        label: m['admin.appellations'],
        description: m['admin.csv_table_appellations']
    },
    wineTypes: { label: m['admin.wine_types'], description: m['admin.csv_table_wine_types'] },
    wineColors: { label: m['admin.wine_colors'], description: m['admin.csv_table_wine_colors'] },
    wineClassifications: {
        label: m['admin.classifications'],
        description: m['admin.csv_table_classifications']
    },
    wineFormats: {
        label: m['admin.wine_formats'],
        description: m['admin.csv_table_wine_formats']
    },
    origins: { label: m['admin.origins'], description: m['admin.csv_table_origins'] },
    wineImages: { label: m['admin.wine_images'], description: m['admin.csv_table_wine_images'] },
    storageContainers: {
        label: m['common.storage_containers'],
        description: m['admin.csv_table_storage_containers']
    },
    storageCases: {
        label: m['common.storage_cases'],
        description: m['admin.csv_table_storage_cases']
    },
    producers: {
        label: m['navigation.producers'],
        description: m['admin.csv_table_producers']
    },
    wineDefinitions: {
        label: m['common.wines'],
        description: m['admin.csv_table_wine_definitions'],
        note: m['admin.csv_table_wine_definitions_note']
    },
    wineBottles: { label: m['admin.wine_bottles'], description: m['admin.csv_table_wine_bottles'] }
};

/** The delimiters that the CSV export can write and the import can read. */
export function csvDelimiterOptions() {
    return [
        { value: ',', label: ',' },
        { value: ';', label: ';' },
        { value: '\t', label: m['admin.csv_tab_delimiter']() },
        { value: '|', label: '|' }
    ];
}
