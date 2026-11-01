import { z } from 'zod';
import { name } from './common.js';

/** A row that only has a name, as the API takes the rows of every reference table. */
export const namedSchema = z.object({ name });

/** The colour value of a wine colour: `#rrggbb`, stored in lower case. */
const hexColor = z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'A colour is written #rrggbb')
    .toLowerCase();

/**
 * A wine colour as the API takes it. Without `hex`, a new colour starts with the one of its name
 * (startingHex) and a renamed one keeps its own.
 */
export const wineColorBodySchema = z.object({ name, hex: hexColor.optional() });

// The export files name the field of these two tables after their column.
export const wineTypeSchema = z.object({ type: name });

// An export made before 1.4.0 has no `hex`: the import gives the colour of its name.
export const wineColorSchema = z.object({ color: name, hex: hexColor.optional() });
