import { listBottlesToDrink } from '#lib/server/features/bottles/service.js';
import { CELLAR } from '#lib/shared/dependencies.js';
import type { PageServerLoad } from './$types';

// Public data only, as GET /api/bottles/to-drink gives it: every bottle to drink soon, the most
// urgent first. The page filters, sorts, groups and pages them itself, from its URL: the banner of
// the wine list loads the same list whole.
export const load: PageServerLoad = ({ depends }) => {
    depends(CELLAR);
    return { bottles: listBottlesToDrink() };
};
