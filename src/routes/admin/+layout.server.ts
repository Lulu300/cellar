import { redirectWithoutSession } from '#lib/server/session.js';
import { getUpgradeNotice } from '#lib/server/upgrade.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
    ...redirectWithoutSession(locals),
    // Shown on every admin page until the actions are ticked.
    upgrade: getUpgradeNotice()
});
