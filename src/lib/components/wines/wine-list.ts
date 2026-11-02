import { iconButton as quietIconButton } from '#lib/components/layout/button-states.js';
import { m } from '#lib/paraglide/messages.js';
import type { WineListView } from '#lib/utils/wine-filters.js';

/** An icon button of a wine card or row: above the link that covers it. */
export const iconButton = `${quietIconButton} relative z-10`;

/** The views of the wine list, as the page and the preferences offer them. */
export const viewOptions = (): { value: WineListView; label: string }[] => [
    { value: 'cards', label: m['common.cards']() },
    { value: 'list', label: m['common.list']() }
];
