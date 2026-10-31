import {
    countBottlesByAvailability,
    getWineShortages
} from '#lib/server/features/bottles/service.js';
import {
    originHandlers,
    wineClassificationHandlers,
    wineColorHandlers,
    wineFormatHandlers,
    wineTypeHandlers
} from '#lib/server/features/catalog/service.js';
import { countryHandlers, regionHandlers } from '#lib/server/features/geography/service.js';
import { accessCodeExists } from '#lib/server/features/settings/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { LayoutServerLoad } from './$types';

// Public data only, as the GET routes of the API give it: reads need no session (SEC-02).
export const load: LayoutServerLoad = async ({ depends, locals }) => {
    depends(CELLAR);
    return {
        // The first render shows the menu and the buttons of this session (stores/auth.svelte.ts),
        // as GET /api/session and GET /api/access-code would tell it.
        authenticated: locals.session !== null,
        accessCodeSet: await accessCodeExists(),
        // The counts of the navigation, and of the link to the bottles out of the cellar
        shortageCount: (await getWineShortages()).length,
        outOfCellarCount: countBottlesByAvailability(BottleAvailability.OUT_OF_CELLAR),
        // The reference lists shared by the pages, loaded once rather than by each component
        references: {
            wineTypes: wineTypeHandlers.list(),
            wineColors: wineColorHandlers.list(),
            wineClassifications: wineClassificationHandlers.list(),
            wineFormats: wineFormatHandlers.list(),
            countries: countryHandlers.list(),
            regions: regionHandlers.list(),
            origins: originHandlers.list()
        }
    };
};
