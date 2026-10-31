import { z } from 'zod';
import { MAX_ACCESS_CODE_LENGTH } from '#lib/server/access-code.js';
import { EXPORT_TABLES, type ExportTableName } from '#lib/server/features/backup/export.js';
import { BACKUP_MODES, INTERVAL_HOURS, KEEP_COUNT } from '#lib/server/features/backup/scheduler.js';
import { MAX_SETUP_TOKEN_LENGTH } from '#lib/server/setup-token.js';
import {
    MAX_SESSION_TIMEOUT_HOURS,
    MIN_SESSION_TIMEOUT_HOURS
} from '#lib/shared/session-timeout.js';
import { MIN_ACCESS_CODE_LENGTH } from '#lib/utils/access-code.js';

// The bodies of the routes that no form shares, here rather than in their route so that the
// OpenAPI description (openapi.ts) reads them too.

const code = z.string().min(1).max(MAX_ACCESS_CODE_LENGTH);

/** A code about to be stored. */
const newCode = z.string().min(MIN_ACCESS_CODE_LENGTH).max(MAX_ACCESS_CODE_LENGTH);

export const loginRequest = z.object({ code });

export const firstCodeRequest = z.object({
    newCode,
    setupToken: z.string().min(1).max(MAX_SETUP_TOKEN_LENGTH)
});

export const codeChangeRequest = z.object({ currentCode: code, newCode });

const sessionTimeoutError = `Session timeout must be a whole number of hours between ${MIN_SESSION_TIMEOUT_HOURS} and ${MAX_SESSION_TIMEOUT_HOURS}`;

export const settingsRequest = z.object({
    sessionTimeoutHours: z
        .int(sessionTimeoutError)
        .min(MIN_SESSION_TIMEOUT_HOURS, sessionTimeoutError)
        .max(MAX_SESSION_TIMEOUT_HOURS, sessionTimeoutError)
});

const range = ({ min, max }: { min: number; max: number }) => z.int().min(min).max(max);

export const backupSettingsRequest = z.object({
    autoBackupEnabled: z.boolean(),
    autoBackupInterval: range(INTERVAL_HOURS),
    autoBackupKeepCount: range(KEEP_COUNT),
    // Optional: a request without it keeps the stored mode.
    autoBackupMode: z.enum(BACKUP_MODES).optional()
});

export const barcodeSettingsRequest = z.object({
    autoGeneration: z.boolean(),
    prefix: z.string().max(100),
    startNumber: z.int().min(1)
});

export const csvExportRequest = z.object({
    tables: z
        .array(
            z
                .string()
                .refine(
                    (table): table is ExportTableName => Object.hasOwn(EXPORT_TABLES, table),
                    'Unknown table'
                )
        )
        .min(1),
    customName: z.string().optional(),
    delimiter: z.string().min(1).max(5).default(',')
});

export const imageRenameRequest = z.object({
    imageId: z.string().min(1),
    newFilename: z.string().min(1)
});

export const imagesDeleteRequest = z.object({
    imageIds: z.array(z.string().min(1)).min(1),
    force: z.boolean().default(false)
});

export const imagesDownloadRequest = z.object({
    imageIds: z.array(z.string()).min(1).max(10000)
});

export const upgradeTickRequest = z.object({
    version: z.string(),
    index: z.int(),
    done: z.boolean()
});
