// The reference tables served by `/api/<table>`, which the admin edits on `/admin/data/<table>`.

const REFERENCE_SLUGS = [
    'countries',
    'regions',
    'appellations',
    'wine-types',
    'wine-colors',
    'wine-classifications',
    'wine-formats',
    'origins',
    'producers'
] as const;

export type ReferenceSlug = (typeof REFERENCE_SLUGS)[number];

export const isReferenceSlug = (slug: string): slug is ReferenceSlug =>
    (REFERENCE_SLUGS as readonly string[]).includes(slug);

/** A row of a reference table, as `/api/<table>` answers it. */
export interface ReferenceRow {
    id: string;
    name: string;
    countryId?: string;
    countryName?: string | null;
    regionId?: string;
    regionName?: string | null;
    /** The colour value of a wine colour. */
    hex?: string;
    /** The wines of a producer. */
    wineCount?: number;
}
