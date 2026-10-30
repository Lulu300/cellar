import {
    barcodeStats,
    getBarcodeSettings,
    manualBarcodeStats
} from '#lib/server/features/barcode/service.js';
import { listPresets } from '#lib/server/features/labels/service.js';
import { LABEL_PRESETS } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends }) => {
    // The layout redirects first when there is no session: the settings and the presets come
    // from the admin API, which needs one.
    await parent();
    depends(LABEL_PRESETS);
    return {
        barcodeSettings: getBarcodeSettings(),
        barcodeStats: barcodeStats(),
        manualBarcodeStats: manualBarcodeStats(),
        labelPresets: listPresets()
    };
};
