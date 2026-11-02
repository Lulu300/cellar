import { buttonVariants } from '#lib/components/ui/button/index.js';

// The states of a button made by hand, as the Button component draws them (UI-33).

/** The keyboard focus of every button: the ring of the Button component. */
export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring';

/**
 * A quiet button that cannot take the layout of the Button component, such as a tile or a table
 * header: the hover of the ghost variant, the focus ring, and no reaction while disabled.
 */
export const quietButton = `${focusRing} transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50`;

/** An icon button: the ghost variant, its icon grey until the pointer is over it. */
export const iconButton = buttonVariants({
    variant: 'ghost',
    size: 'icon',
    class: 'text-muted-foreground'
});
