/** Where a bottle is: in the cellar, taken out of it, or drunk. */
export const BottleAvailability = {
    AVAILABLE: 'available',
    OUT_OF_CELLAR: 'out_of_cellar',
    CONSUMED: 'consumed'
} as const;

// A union of literals rather than an enum, so that a plain 'available' type-checks too.
export type BottleAvailability = (typeof BottleAvailability)[keyof typeof BottleAvailability];
