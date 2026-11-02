/**
 * The shapes the API answers, one per endpoint, for the pages and components that read them.
 *
 * Each is derived from the code that builds the answer, so that the two cannot drift apart: the
 * service, or the query of a reference table. What is spelt out is not checked against the
 * route: the few fields that a route adds around what its service returns.
 * The imports are type-only: TypeScript erases them, so no server code reaches the browser.
 */
import type { LabelPreset, StorageCase, StorageContainer } from '#lib/server/db/schema.js';
import type { importJson } from '#lib/server/features/backup/json-import.js';
import type {
    createManualBackup,
    createManualExport,
    exportCsvTables,
    getBackupSettingsView,
    restoreBackup,
    wipeDatabase
} from '#lib/server/features/backup/service.js';
import type { BackupFile } from '#lib/server/features/backup/files.js';
import type { createStoredToken } from '#lib/server/bearer-token.js';
import type { getMcpTokenView } from '#lib/server/features/mcp/token.js';
import type {
    BarcodeConflictInfo,
    getBarcodeSettings,
    nextBarcode,
    updateBarcodeSettings
} from '#lib/server/features/barcode/service.js';
import type {
    getWineShortages,
    listBottlesForAdmin,
    listBottlesNotConsumed,
    listBottlesWithDefinitions,
    WineBottleWithFormat
} from '#lib/server/features/bottles/service.js';
import type { listWishes } from '#lib/server/features/wishlist/service.js';
import type {
    createDefinition,
    listDefinitions,
    listDefinitionsForAdmin,
    listWines
} from '#lib/server/features/catalog/service.js';
import type {
    appellationsWithRegion,
    regionsWithCountry
} from '#lib/server/features/geography/repository.js';
import type { csvImportTables, importCsv } from '#lib/server/features/csv-import/service.js';
import type {
    importImagesZip,
    listImagesWithStats,
    renameImage,
    uploadImage,
    uploadImages
} from '#lib/server/features/images/service.js';
import type { storageOverview, wineLocations } from '#lib/server/features/storage/service.js';

/**
 * What `JSON.stringify` makes of a value, which is what `fetch` gives back: dates become ISO
 * strings. A load function keeps dates as they are, so its data needs no such conversion.
 */
export type Jsonified<T> = T extends Date
    ? string
    : T extends (infer Item)[]
      ? Jsonified<Item>[]
      : T extends object
        ? { [Key in keyof T]: Jsonified<T[Key]> }
        : T;

// Reference tables: GET /api/<table> (lookup-crud names the name column `name` in every table).

export type { StorageCase, StorageContainer, LabelPreset };

/** The rows of a query of a reference table. */
type RowOf<Query extends (...args: never[]) => { all(): unknown[] }> = ReturnType<
    ReturnType<Query>['all']
>[number];

/** GET /api/regions */
type RegionDTO = RowOf<typeof regionsWithCountry>;

/** GET /api/appellations */
export type AppellationDTO = RowOf<typeof appellationsWithRegion>;

/** A row of a reference list, as the forms offer it. */
type ReferenceOption = { id: string; name: string };

/** The reference lists that the root layout gives every page (`page.data.references`). */
export type ReferencesDTO = Record<
    'wineTypes' | 'wineColors' | 'wineClassifications' | 'wineFormats' | 'countries' | 'origins',
    ReferenceOption[]
> & { regions: (ReferenceOption & Pick<RegionDTO, 'countryId' | 'countryName'>)[] };

// Wines and bottles

/**
 * GET /api/wines: one entry per wine, with the wine in `definition` and its bottles in `bottles`.
 * The wine list loads the same entries with only the bottles still owned.
 */
export type WineGroupDTO = ReturnType<typeof listWines>[number];

/** A bottle of a WineGroupDTO, with its format, case and origin but not its wine. */
export type ListedBottleDTO = WineGroupDTO['bottles'][number];

/** GET /api/bottles: a bottle with its wine, format, case and origin. */
export type BottleWithDefinitionDTO = ReturnType<typeof listBottlesWithDefinitions>[number];

/** GET /api/definitions */
export type DefinitionDTO = ReturnType<typeof listDefinitions>[number];

/** GET /api/wishes, and POST and PUT /api/wishes/{id}: a wish with its wine or its photo. */
export type WishDTO = ReturnType<typeof listWishes>[number];

/** POST /api/definitions and PUT /api/definitions/{id}: the wine as saved. */
export type SavedDefinitionDTO = ReturnType<typeof createDefinition>;

/** A bottle as POST and PATCH /api/bottles answer it: its row and the name of its format. */
export type BottleDTO = WineBottleWithFormat;

/** GET /api/bottles/non-consumed */
export type OwnedBottleDTO = ReturnType<typeof listBottlesNotConsumed>[number];

/** GET /api/wine-shortage */
export type WineShortageDTO = Awaited<ReturnType<typeof getWineShortages>>[number];

// Storage

/** A container of the storage page, with its cases in order and the bottles each one holds. */
export type StorageContainerDTO = ReturnType<typeof storageOverview>[number];

/** GET /api/wines/{id}/locations */
export type WineLocationsDTO = ReturnType<typeof wineLocations>;

// Admin

/** GET /api/admin/wine-definitions */
export type AdminDefinitionDTO = ReturnType<typeof listDefinitionsForAdmin>[number];

/** GET /api/admin/wine-bottles */
export type AdminBottleDTO = ReturnType<typeof listBottlesForAdmin>[number];

/** An image of GET /api/admin/images, with the size and date of its file. */
export type AdminImageDTO = Awaited<ReturnType<typeof listImagesWithStats>>[number];

/** GET /api/admin/images */
export type AdminImagesDTO = { images: AdminImageDTO[]; count: number };

/** PUT /api/admin/images */
export type ImageRenameDTO = Awaited<ReturnType<typeof renameImage>>;

/** POST /api/admin/upload-image */
export type UploadedImagesDTO = Awaited<ReturnType<typeof uploadImages>>;

/** POST /api/upload/image */
export type UploadedImageDTO = Awaited<ReturnType<typeof uploadImage>>;

/** A file of GET /api/admin/list-backups. */
export type BackupFileDTO = BackupFile;

/** POST /api/admin/create-backup */
export type BackupCreatedDTO = { success: true; message: string } & Awaited<
    ReturnType<typeof createManualBackup>
>;

/** POST /api/admin/create-export */
export type ExportCreatedDTO = {
    success: true;
    message: string;
    files: { zip: Awaited<ReturnType<typeof createManualExport>>['file'] };
    recordCount: Awaited<ReturnType<typeof createManualExport>>['recordCount'];
    restorable: Awaited<ReturnType<typeof createManualExport>>['restorable'];
};

/** POST /api/admin/restore */
export type RestoreDTO = Awaited<ReturnType<typeof restoreBackup>>;

/** POST /api/admin/import-json */
export type JsonImportDTO = Awaited<ReturnType<typeof importJson>>;

/** POST /api/admin/wipe-database: the backup made before the wipe. */
export type WipeDTO = Awaited<ReturnType<typeof wipeDatabase>>;

/** POST /api/admin/export-csv: the files themselves, as nothing is written on the server. */
export type CsvExportDTO = { success: true; message: string } & ReturnType<typeof exportCsvTables>;

/** POST /api/admin/backup-token and /api/admin/mcp-token: the new token, shown this once. */
export type NewTokenDTO = { token: ReturnType<typeof createStoredToken> };

/** GET /api/admin/backup-settings */
export type BackupSettingsDTO = ReturnType<typeof getBackupSettingsView>;

/** PUT /api/admin/mcp-token, and the page data of Admin › Settings */
export type McpTokenDTO = ReturnType<typeof getMcpTokenView>;

/** GET /api/admin/barcode-settings */
export type BarcodeSettingsDTO = ReturnType<typeof getBarcodeSettings>;

/** PUT /api/admin/barcode-settings: the settings as saved, and where the codes go on from. */
export type BarcodeSettingsUpdateDTO = BarcodeSettingsDTO & {
    conflictInfo: ReturnType<typeof updateBarcodeSettings>;
};

/** The `conflictInfo` of PUT /api/admin/barcode-settings, when automatic barcodes are on. */
export type BarcodeConflictDTO = BarcodeConflictInfo;

/** POST /api/admin/import-csv */
export type CsvImportDTO = Awaited<ReturnType<typeof importCsv>>;

/** A table of the CSV export and import. */
export type CsvTable = NonNullable<CsvImportDTO['results'][number]['table']>;

/** A table of the CSV import with the columns of its files, as the admin page loads it. */
export type CsvImportTableDTO = ReturnType<typeof csvImportTables>[number];

/** POST /api/admin/import-images-zip */
export type ZipImportDTO = Awaited<ReturnType<typeof importImagesZip>>;

/** GET /api/admin/next-barcode */
export type NextBarcodeDTO = ReturnType<typeof nextBarcode>;
