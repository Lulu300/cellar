import { z } from 'zod';
import { id, name } from './common.js';

export const regionSchema = z.object({ name, countryId: id });

export const appellationSchema = z.object({ name, regionId: id });
