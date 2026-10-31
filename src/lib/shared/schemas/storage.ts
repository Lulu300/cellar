import { z } from 'zod';
import { maxLength, name, NAME_MAX_LENGTH } from './common.js';

const CASE_SUFFIX_MAX_LENGTH = 50;

/**
 * The suffix of each case, appended to the container's name: "A" and "1" make case "A1". Only its
 * trailing blanks are dropped: a space typed before it separates it from the name, " top" making
 * "A top".
 */
const caseSuffixes = z
    .array(
        z
            .string()
            .overwrite((suffix) => suffix.trimEnd())
            .check(maxLength(CASE_SUFFIX_MAX_LENGTH))
    )
    .max(500);

/**
 * The name of a case, as the imports read it: its container's name followed by its suffix, so
 * longer than a name can be.
 */
export const caseName = z
    .string()
    .trim()
    .min(1)
    .check(maxLength(NAME_MAX_LENGTH + CASE_SUFFIX_MAX_LENGTH));

/** The number of bottles a case holds. */
export const caseCapacitySchema = z.int().min(1).max(1000);

/** The place of a case in its container, from 0. */
export const casePosition = z.int().min(0).max(100000);

/** The capacity of each case, in the order of the suffixes; a missing one is 5. */
const caseCapacities = z.array(caseCapacitySchema.nullish()).max(500).default([]);

export const DEFAULT_CASE_CAPACITY = 5;

export const newContainerSchema = z.object({ name, cases: caseSuffixes, caseCapacities });

/**
 * Every case of the container, in their order: a case it lacks is deleted. `caseIds` holds the id
 * of each existing case, in the order of the suffixes, and nothing for a case to create.
 */
export const containerSchema = z
    .object({
        name,
        cases: caseSuffixes,
        caseCapacities,
        caseIds: z.array(z.string().max(100).nullish()).max(500).default([]),
        /** The `updatedAt` of the container that the draft was made from: a newer one is refused. */
        updatedAt: z.iso.datetime({ offset: true }).optional()
    })
    .refine(({ cases, caseIds }) => caseIds.length <= cases.length, {
        path: ['caseIds'],
        message: 'At most one id for each case'
    })
    .refine(
        ({ caseIds }) => {
            const ids = caseIds.filter((id) => id);
            return new Set(ids).size === ids.length;
        },
        { path: ['caseIds'], message: 'A case appears twice' }
    );
