import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { backupFileRequest, manualBackupRequest } from '#lib/server/features/backup/files.js';
import { csvImportForm } from '#lib/server/features/csv-import/service.js';
import {
    backupSettingsRequest,
    barcodeSettingsRequest,
    codeChangeRequest,
    csvExportRequest,
    firstCodeRequest,
    imageRenameRequest,
    imagesDeleteRequest,
    imagesDownloadRequest,
    loginRequest,
    settingsRequest,
    upgradeTickRequest
} from '#lib/server/http/request-schemas.js';
import { requiresSession, SESSION_COOKIE } from '#lib/server/session.js';
import { API_ERROR_CODES } from '#lib/shared/api-error.js';
import {
    bottleChangesSchema,
    bulkBottleChangesSchema,
    newBottlesSchema
} from '#lib/shared/schemas/bottle.js';
import { appellationSchema, regionSchema } from '#lib/shared/schemas/geography.js';
import {
    labelPresetSchema,
    labelRangeSchema,
    labelSheetSchema
} from '#lib/shared/schemas/label.js';
import { namedSchema } from '#lib/shared/schemas/reference.js';
import { containerSchema, newContainerSchema } from '#lib/shared/schemas/storage.js';
import { wineDefinitionSchema } from '#lib/shared/schemas/wine.js';

/**
 * The OpenAPI 3.1 description of the API under /api, for tools: its request bodies come from the
 * zod schemas that the routes check them with. docs/openapi.json holds it, and openapi.test.ts
 * fails when that file is out of date or when a route of the code is missing here.
 */

const API_DOC = 'https://github.com/Lulu300/cellar/blob/main/docs/API.md';

type MediaType =
    'application/json' | 'multipart/form-data' | 'application/zip' | 'text/csv' | 'application/pdf';

/** A section of docs/API.md, which describes the answers of its routes. */
const tags = {
    session: ['Session and access code', 'session-and-access-code'],
    settings: ['Settings', 'settings'],
    wines: ['Wines', 'wines'],
    bottles: ['Bottles', 'bottles'],
    references: ['Reference tables', 'reference-tables'],
    statistics: ['Statistics and shortage', 'statistics-and-shortage'],
    images: ['Images', 'images'],
    storage: ['Storage', 'storage'],
    barcodes: ['Barcodes and labels', 'barcodes-and-labels'],
    barcodeSettings: ['Barcode settings', 'barcode-settings'],
    labelPresets: ['Label presets', 'label-presets'],
    backups: ['Backups', 'backups'],
    autoBackups: ['Automatic backups', 'automatic-backups'],
    csv: ['CSV import and export', 'csv-import-and-export'],
    data: ['Data', 'data'],
    adminImages: ['Admin images', 'images-1'],
    upgradeActions: ['Upgrade actions', 'upgrade-actions']
} as const satisfies Record<string, readonly [name: string, anchor: string]>;

interface Parameter {
    name: string;
    required?: boolean;
    description: string;
}

interface Operation {
    tag: keyof typeof tags;
    summary: string;
    query?: Parameter[];
    /** The schema of the body for each media type the route takes. */
    body?: Partial<Record<MediaType, z.ZodType>>;
    /** Each status of success, with the media type of its body. */
    answers: Record<number, MediaType | null>;
    /** The cron job's token opens it as well as a session. */
    cronToken?: true;
}

const json = (schema: z.ZodType) => ({ 'application/json': schema });
const form = (shape: z.ZodRawShape) => ({ 'multipart/form-data': z.object(shape) });

/** A backup of the server's list, by its name, or a zip sent as the raw body. */
const zipSource = { ...json(backupFileRequest), 'application/zip': z.file() };

const ok = { 200: 'application/json' } as const;
const created = { 201: 'application/json' } as const;
const noContent = { 204: null } as const;

/** The routes of a reference table (lookup-crud.ts); `filter` keeps the rows of a parent. */
function referenceTable(path: string, schema: z.ZodType, filter?: Parameter) {
    const query = filter && [filter];
    const tag = 'references';
    return {
        [`GET ${path}`]: {
            tag,
            summary: 'The rows, by name',
            ...(query && { query }),
            answers: ok
        },
        [`POST ${path}`]: {
            tag,
            summary: 'Adds a row, or gives the row that already has this name (200)',
            body: json(schema),
            answers: { 200: 'application/json', 201: 'application/json' }
        },
        [`PUT ${path}/[id]`]: { tag, summary: 'Renames a row', body: json(schema), answers: ok },
        [`DELETE ${path}/[id]`]: {
            tag,
            summary: 'Deletes a row that nothing uses',
            answers: noContent
        }
    } satisfies Record<string, Operation>;
}

/** Every route and method of the API, by `METHOD route id`. */
const operations: Record<string, Operation> = {
    'GET /api/access-code': {
        tag: 'session',
        summary: 'Whether an access code is set',
        answers: ok
    },
    'POST /api/access-code': {
        tag: 'session',
        summary: 'Logs in with the access code, or sets the first one with the setup token',
        body: json(z.union([loginRequest, firstCodeRequest])),
        answers: ok
    },
    'PUT /api/access-code': {
        tag: 'session',
        summary: 'Changes the access code',
        body: json(codeChangeRequest),
        answers: noContent
    },
    'GET /api/session': {
        tag: 'session',
        summary: 'Whether the request has a session',
        answers: ok
    },
    'DELETE /api/session': { tag: 'session', summary: 'Logs out', answers: noContent },

    'GET /api/settings': { tag: 'settings', summary: 'The settings', answers: ok },
    'PUT /api/settings': {
        tag: 'settings',
        summary: 'Saves the settings',
        body: json(settingsRequest),
        answers: ok
    },

    'GET /api/wines': { tag: 'wines', summary: 'The wines, with their bottle counts', answers: ok },
    'GET /api/wines/[id]/locations': {
        tag: 'wines',
        summary: 'Where the bottles of a wine are',
        answers: ok
    },
    'GET /api/definitions': { tag: 'wines', summary: 'The wines', answers: ok },
    'POST /api/definitions': {
        tag: 'wines',
        summary: 'Adds a wine',
        body: json(wineDefinitionSchema),
        answers: created
    },
    'GET /api/definitions/[id]': { tag: 'wines', summary: 'A wine', answers: ok },
    'PUT /api/definitions/[id]': {
        tag: 'wines',
        summary: 'Replaces every field of a wine',
        body: json(wineDefinitionSchema),
        answers: ok
    },
    'DELETE /api/definitions/[id]': {
        tag: 'wines',
        summary: 'Deletes a wine that has no bottles',
        answers: noContent
    },

    'GET /api/bottles': { tag: 'bottles', summary: 'The bottles, with their wine', answers: ok },
    'POST /api/bottles': {
        tag: 'bottles',
        summary: 'Adds bottles of a wine',
        body: json(newBottlesSchema),
        answers: created
    },
    'PATCH /api/bottles': {
        tag: 'bottles',
        summary: 'Changes the same fields of several bottles',
        body: json(bulkBottleChangesSchema),
        answers: ok
    },
    'PATCH /api/bottles/[id]': {
        tag: 'bottles',
        summary: 'Changes some fields of a bottle',
        body: json(bottleChangesSchema),
        answers: ok
    },
    'DELETE /api/bottles/[id]': { tag: 'bottles', summary: 'Deletes a bottle', answers: noContent },
    'GET /api/bottles/non-consumed': {
        tag: 'bottles',
        summary: 'The bottles not consumed',
        answers: ok
    },

    ...referenceTable('/api/countries', namedSchema),
    ...referenceTable('/api/regions', regionSchema, {
        name: 'countryId',
        description: 'Only the regions of this country.'
    }),
    ...referenceTable('/api/appellations', appellationSchema, {
        name: 'regionId',
        description: 'Only the appellations of this region.'
    }),
    ...referenceTable('/api/wine-types', namedSchema),
    ...referenceTable('/api/wine-colors', namedSchema),
    ...referenceTable('/api/wine-classifications', namedSchema),
    ...referenceTable('/api/wine-formats', namedSchema),
    ...referenceTable('/api/origins', namedSchema),

    'GET /api/statistics': {
        tag: 'statistics',
        summary: 'The statistics of the cellar',
        answers: ok
    },
    'GET /api/wine-shortage': {
        tag: 'statistics',
        summary: 'The wines below their minimum stock',
        answers: ok
    },

    'GET /api/images': { tag: 'images', summary: 'The id and URL of each image', answers: ok },
    'POST /api/upload/image': {
        tag: 'images',
        summary: 'Saves the image of a wine',
        body: form({ image: z.file() }),
        answers: created
    },

    'GET /api/storage-containers': {
        tag: 'storage',
        summary: 'The containers, with their cases',
        answers: ok
    },
    'POST /api/storage-containers': {
        tag: 'storage',
        summary: 'Adds a container and its cases',
        body: json(newContainerSchema),
        answers: created
    },
    'PUT /api/storage-containers/[id]': {
        tag: 'storage',
        summary: 'Replaces a container and every case of it',
        body: json(containerSchema),
        answers: ok
    },
    'DELETE /api/storage-containers/[id]': {
        tag: 'storage',
        summary: 'Deletes a container and its cases',
        answers: noContent
    },
    'GET /api/storage-cases': { tag: 'storage', summary: 'The cases', answers: ok },
    'DELETE /api/storage-cases/[id]': {
        tag: 'storage',
        summary: 'Deletes a case',
        answers: noContent
    },
    'GET /api/storage-cases/[id]/capacity': {
        tag: 'storage',
        summary: 'How many bottles a case holds and has room for',
        answers: ok
    },
    'GET /api/storage-occupancy': {
        tag: 'storage',
        summary: 'The number of available bottles of each case',
        answers: ok
    },

    'GET /api/barcode/stats': {
        tag: 'barcodes',
        summary: 'The codes of the configured prefix',
        answers: ok
    },
    'GET /api/barcode/stats-manual': {
        tag: 'barcodes',
        summary: 'The codes of every prefix',
        answers: ok
    },
    'GET /api/barcode/export-all': {
        tag: 'barcodes',
        summary: 'The bottles with a code of the configured prefix, as CSV',
        answers: { 200: 'text/csv' }
    },
    'GET /api/barcode/export-manual': {
        tag: 'barcodes',
        summary: 'The bottles with a barcode, as CSV',
        answers: { 200: 'text/csv' }
    },
    'POST /api/barcode/csv': {
        tag: 'barcodes',
        summary: 'A range of codes, as CSV',
        body: json(labelRangeSchema),
        answers: { 200: 'text/csv' }
    },
    'POST /api/barcode/pdf-labels': {
        tag: 'barcodes',
        summary: 'A sheet of labels, as PDF',
        body: json(labelSheetSchema),
        answers: { 200: 'application/pdf' }
    },

    'GET /api/admin/barcode-settings': {
        tag: 'barcodeSettings',
        summary: 'The barcode settings',
        answers: ok
    },
    'PUT /api/admin/barcode-settings': {
        tag: 'barcodeSettings',
        summary: 'Saves the barcode settings',
        body: json(barcodeSettingsRequest),
        answers: ok
    },
    'GET /api/admin/next-barcode': {
        tag: 'barcodeSettings',
        summary: 'The next automatic barcode',
        answers: ok
    },

    'GET /api/admin/label-presets': {
        tag: 'labelPresets',
        summary: 'The label presets',
        answers: ok
    },
    'POST /api/admin/label-presets': {
        tag: 'labelPresets',
        summary: 'Adds a label preset',
        body: json(labelPresetSchema),
        answers: created
    },
    'GET /api/admin/label-presets/[id]': {
        tag: 'labelPresets',
        summary: 'A label preset',
        answers: ok
    },
    'PUT /api/admin/label-presets/[id]': {
        tag: 'labelPresets',
        summary: 'Replaces every field of a label preset',
        body: json(labelPresetSchema),
        answers: ok
    },
    'DELETE /api/admin/label-presets/[id]': {
        tag: 'labelPresets',
        summary: 'Deletes a label preset',
        answers: noContent
    },

    'GET /api/admin/list-backups': {
        tag: 'backups',
        summary: 'The backups and exports on the server',
        answers: ok
    },
    'POST /api/admin/create-backup': {
        tag: 'backups',
        summary: 'Writes a backup of the database and the images',
        body: json(manualBackupRequest),
        answers: created
    },
    'POST /api/admin/create-export': {
        tag: 'backups',
        summary: 'Writes an export of the data and the images',
        body: json(manualBackupRequest),
        answers: created
    },
    'GET /api/admin/download-backup': {
        tag: 'backups',
        summary: 'Downloads a backup or an export',
        query: [
            {
                name: 'filename',
                required: true,
                description: 'The name of the file, as the list of backups gives it.'
            }
        ],
        answers: { 200: 'application/zip' }
    },
    'DELETE /api/admin/delete-backup': {
        tag: 'backups',
        summary: 'Deletes a backup or an export',
        body: json(backupFileRequest),
        answers: noContent
    },
    'POST /api/admin/restore': {
        tag: 'backups',
        summary: 'Restores a backup',
        body: zipSource,
        answers: ok
    },
    'POST /api/admin/import-json': {
        tag: 'backups',
        summary: 'Replaces the data with those of an export',
        body: zipSource,
        answers: ok
    },
    'POST /api/admin/wipe-database': {
        tag: 'backups',
        summary: 'Deletes every wine, bottle and image, after a backup',
        answers: ok
    },

    'GET /api/admin/backup-settings': {
        tag: 'autoBackups',
        summary: 'The settings of the automatic backups',
        answers: ok
    },
    'PUT /api/admin/backup-settings': {
        tag: 'autoBackups',
        summary: 'Saves the settings of the automatic backups',
        body: json(backupSettingsRequest),
        answers: ok
    },
    'POST /api/admin/backup-token': {
        tag: 'autoBackups',
        summary: 'Creates the token of the cron job, replacing the earlier one',
        answers: ok
    },
    'POST /api/admin/auto-backup': {
        tag: 'autoBackups',
        summary: 'Writes an automatic backup and export: the route of the cron job',
        answers: ok,
        cronToken: true
    },

    'POST /api/admin/export-csv': {
        tag: 'csv',
        summary: 'Exports tables as CSV, in the answer',
        body: json(csvExportRequest),
        answers: ok
    },
    'POST /api/admin/import-csv': {
        tag: 'csv',
        summary: 'Imports CSV files, each named after its table',
        body: { 'multipart/form-data': csvImportForm },
        answers: ok
    },

    'GET /api/admin/wine-definitions': {
        tag: 'data',
        summary: 'The wines, with their bottle counts',
        answers: ok
    },
    'DELETE /api/admin/wine-definitions/[id]': {
        tag: 'data',
        summary: 'Deletes a wine, and its bottles when asked',
        query: [
            {
                name: 'cascade',
                description: '`true` deletes the bottles of the wine with it.'
            }
        ],
        answers: noContent
    },
    'GET /api/admin/wine-bottles': { tag: 'data', summary: 'The bottles', answers: ok },
    'DELETE /api/admin/wine-bottles/[id]': {
        tag: 'data',
        summary: 'Deletes a bottle',
        answers: noContent
    },

    'GET /api/admin/images': {
        tag: 'adminImages',
        summary: 'The images, with their sizes and the wines that use them',
        answers: ok
    },
    'PUT /api/admin/images': {
        tag: 'adminImages',
        summary: 'Renames an image',
        body: json(imageRenameRequest),
        answers: ok
    },
    'DELETE /api/admin/images': {
        tag: 'adminImages',
        summary: 'Deletes images',
        body: json(imagesDeleteRequest),
        answers: noContent
    },
    'POST /api/admin/upload-image': {
        tag: 'adminImages',
        summary: 'Saves one image, or several',
        body: form({ image: z.file().optional(), images: z.array(z.file()).optional() }),
        answers: created
    },
    'POST /api/admin/download-images': {
        tag: 'adminImages',
        summary: 'Downloads images as a zip',
        body: json(imagesDownloadRequest),
        answers: { 200: 'application/zip' }
    },
    'POST /api/admin/import-images-zip': {
        tag: 'adminImages',
        summary: 'Saves the images of a zip',
        body: form({ zipFile: z.file() }),
        answers: created
    },

    'PUT /api/admin/upgrade-actions': {
        tag: 'upgradeActions',
        summary: 'Ticks or unticks an upgrade action',
        body: json(upgradeTickRequest),
        answers: ok
    }
};

/** What the request may send, as zod reads it; without the `$schema` that OpenAPI does not need. */
function schemaOf(schema: z.ZodType) {
    const jsonSchema = z.toJSONSchema(schema, { io: 'input' });
    delete jsonSchema.$schema;
    return jsonSchema;
}

const errorBody = z.object({
    error: z.object({
        code: z.enum(API_ERROR_CODES).describe('Stable, for scripts.'),
        message: z.string().describe('In English, for logs and people; it may change.'),
        details: z.unknown().optional().describe('Only for some codes, which docs/API.md lists.')
    })
});

const STATUS_TEXT: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No content' };

/** `/api/bottles/[id]` → `/api/bottles/{id}`, as docs/API.md writes it too. */
export const openApiPath = (routeId: string) => routeId.replace(/\[(\w+)\]/g, '{$1}');

/** `DELETE /api/admin/wine-definitions/[id]` → `deleteAdminWineDefinitionsId` */
function operationId(method: string, routeId: string): string {
    const words = routeId.replace(/^\/api\//, '').split(/[^a-zA-Z0-9]+/);
    return [
        method.toLowerCase(),
        ...words.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    ].join('');
}

function operationObject(method: string, routeId: string, operation: Operation) {
    // The session rule of the server, rather than a copy of it.
    const event = { request: new Request('http://localhost/', { method }), route: { id: routeId } };
    const needsSession = requiresSession(event as RequestEvent);
    const pathParameters = [...routeId.matchAll(/\[(\w+)\]/g)].map(([, name]) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' }
    }));
    const queryParameters = (operation.query ?? []).map(({ name, required, description }) => ({
        name,
        in: 'query',
        required: required ?? false,
        description,
        schema: { type: 'string' }
    }));
    const parameters = [...pathParameters, ...queryParameters];
    const body = operation.body && Object.entries(operation.body);
    return {
        tags: [tags[operation.tag][0]],
        summary: operation.summary,
        operationId: operationId(method, routeId),
        security: needsSession
            ? [{ session: [] }, ...(operation.cronToken ? [{ cronToken: [] }] : [])]
            : [],
        ...(parameters.length > 0 && { parameters }),
        ...(body && {
            requestBody: {
                required: body.some(([, schema]) => !schema.safeParse(undefined).success),
                content: Object.fromEntries(
                    body.map(([type, schema]) => [type, { schema: schemaOf(schema) }])
                )
            }
        }),
        responses: {
            ...Object.fromEntries(
                Object.entries(operation.answers).map(([status, type]) => [
                    status,
                    {
                        description: STATUS_TEXT[Number(status)],
                        ...(type && { content: { [type]: {} } })
                    }
                ])
            ),
            default: { $ref: '#/components/responses/Error' }
        }
    };
}

const DESCRIPTION = `The HTTP API of Cellar, a self-hosted wine cellar manager. [docs/API.md](${API_DOC}) describes each route in full, with the fields of its answers, which this description leaves out; the request bodies here come from the schemas that the server checks them with.

- **Lengths:** a name, a producer, a description, a note, a grape variety or a case suffix is measured in UTF-16 units once trimmed (a case suffix at its end only), as JavaScript's \`.length\`, a note or a description with its line breaks as LF. \`maxLength\` gives that limit, but a JSON Schema validator counts characters, an emoji as one: it may accept a text with emoji that the server refuses.
- **Reads are public:** every \`GET\` outside \`/api/admin\` works without a session. Every other method, and all of \`/api/admin\`, needs one; \`POST /api/access-code\` logs in and sets the \`${SESSION_COOKIE}\` cookie.
- **Origin check:** a write whose \`Origin\` header is not Cellar's URL gets \`403 cross_site_request\`, and a form upload (\`multipart/form-data\`) or a write without \`Content-Type\` must send that header. Send \`Origin\` with every write.
- **Errors:** every error answer has the body of the \`Error\` response, except the \`403\` of a form write without \`Origin\`, which comes from the server before Cellar's code runs.`;

const ERROR_DESCRIPTION = `An error, with its status and a stable \`code\`. Any route may answer \`400 malformed_body\`, \`401 unauthenticated\`, \`403 cross_site_request\`, \`404 not_found\`, \`405 method_not_allowed\`, \`409 missing_reference\` or \`in_use\`, \`413 body_too_large\`, \`422 invalid_body\` (\`details\` lists each problem as \`{ path, message }\`), \`500 internal_error\` and, for a write while a restore, an import or a wipe runs, \`503 writes_held\` with a \`Retry-After\` header. The other codes belong to some routes, which docs/API.md lists.`;

export function openApiDocument() {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const [key, operation] of Object.entries(operations)) {
        const [method, routeId] = key.split(' ');
        paths[openApiPath(routeId)] ??= {};
        paths[openApiPath(routeId)][method.toLowerCase()] = operationObject(
            method,
            routeId,
            operation
        );
    }
    return {
        openapi: '3.1.1',
        info: {
            title: 'Cellar API',
            // The file is committed: the version of the app would make it stale at every release.
            version: '1',
            description: DESCRIPTION
        },
        externalDocs: { url: API_DOC },
        servers: [
            {
                url: '{origin}',
                variables: {
                    origin: {
                        default: 'http://192.168.1.20:3005',
                        description: 'The URL you open Cellar at, the value of `ORIGIN`.'
                    }
                }
            }
        ],
        tags: Object.values(tags).map(([name, anchor]) => ({
            name,
            externalDocs: { url: `${API_DOC}#${anchor}` }
        })),
        paths,
        components: {
            securitySchemes: {
                session: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: SESSION_COOKIE,
                    description: 'The cookie that `POST /api/access-code` sets.'
                },
                cronToken: {
                    type: 'http',
                    scheme: 'bearer',
                    description: 'The token of the cron job, generated in Admin › Backups.'
                }
            },
            responses: {
                Error: {
                    description: ERROR_DESCRIPTION,
                    content: { 'application/json': { schema: schemaOf(errorBody) } }
                }
            }
        }
    };
}
