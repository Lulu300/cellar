import { buttonVariants } from '#lib/components/ui/button/index.js';

// The states of a button made by hand, as the Button component draws them (UI-33).

/** The keyboard focus of every button: the ring of the Button component. */
export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring';

/** The focus ring, and no reaction while disabled: a button whose hover depends on its state. */
export const buttonStates = `${focusRing} transition-colors disabled:pointer-events-none disabled:opacity-50`;

/**
 * A quiet button that cannot take the layout of the Button component, such as a tile or a table
 * header: the hover of the ghost variant.
 */
export const quietButton = `${buttonStates} hover:bg-accent hover:text-accent-foreground`;

/**
 * A chosen tile, as a filled button: its tint gets stronger under the pointer. Its hints take the
 * text colour, since grey text falls under 4.5:1 on the stronger tint.
 */
export const chosenTile = `${buttonStates} bg-primary/10 hover:bg-primary/30 [&_.text-muted-foreground]:text-foreground`;

/** An icon button: the ghost variant, its icon grey until the pointer is over it. */
export const iconButton = buttonVariants({
    variant: 'ghost',
    size: 'icon',
    class: 'text-muted-foreground'
});
