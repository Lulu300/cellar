import { getBarcodeSettings } from '#lib/server/features/barcode/service.js';
import { getMcpTokenView } from '#lib/server/features/mcp/token.js';
import { getSettings } from '#lib/server/features/settings/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    return {
        settings: getSettings(),
        barcodeSettings: getBarcodeSettings(),
        mcpToken: getMcpTokenView()
    };
};
