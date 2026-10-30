import { appellations, countries, regions, wineDefinitions } from '#lib/server/db/schema.js';
import { createLookupCrud } from '#lib/server/features/shared/lookup-crud.js';
import { appellationSchema, regionSchema } from '#lib/shared/schemas/geography.js';
import { namedSchema } from '#lib/shared/schemas/reference.js';
import { appellationsWithRegion, regionsWithCountry } from './repository';

export const countryHandlers = createLookupCrud({
    table: countries,
    nameColumn: 'name',
    schema: namedSchema,
    usage: { column: regions.countryId, usedBy: 'regions' }
});

export const regionHandlers = createLookupCrud({
    table: regions,
    nameColumn: 'name',
    schema: regionSchema,
    parent: 'countryId',
    rows: regionsWithCountry,
    usage: { column: appellations.regionId, usedBy: 'appellations' }
});

export const appellationHandlers = createLookupCrud({
    table: appellations,
    nameColumn: 'name',
    schema: appellationSchema,
    parent: 'regionId',
    rows: appellationsWithRegion,
    usage: { column: wineDefinitions.appellationId, usedBy: 'wine_definitions' }
});
