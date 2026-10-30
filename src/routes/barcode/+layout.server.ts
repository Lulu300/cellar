import { redirectWithoutSession } from '#lib/server/session.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => redirectWithoutSession(locals);
