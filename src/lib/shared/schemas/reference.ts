import { z } from 'zod';
import { name } from './common.js';

/** A row that only has a name, as the API takes the rows of every reference table. */
export const namedSchema = z.object({ name });

// The export files name the field of these two tables after their column.
export const wineTypeSchema = z.object({ type: name });

export const wineColorSchema = z.object({ color: name });
