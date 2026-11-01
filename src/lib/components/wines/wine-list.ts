import { buttonVariants } from '#lib/components/ui/button/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { WineListView } from '#lib/utils/wine-filters.js';

/** An icon button of a wine card or row: above the link that covers it. */
export const iconButton = buttonVariants({
    variant: 'ghost',
    size: 'icon',
    class: 'relative z-10 text-muted-foreground'
});

/** The views of the wine list, as the page and the preferences offer them. */
export const viewOptions = (): { value: WineListView; label: string }[] => [
    { value: 'cards', label: m['common.cards']() },
    { value: 'list', label: m['common.list']() }
];
