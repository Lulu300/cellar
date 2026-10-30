import { m } from '#lib/paraglide/messages.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';

/** The name of an availability in the language of the interface. */
export function availabilityLabel(availability: string): string {
    switch (availability) {
        case BottleAvailability.OUT_OF_CELLAR:
            return m['availability.out_of_cellar']();
        case BottleAvailability.CONSUMED:
            return m['availability.consumed']();
        default:
            return m['availability.available']();
    }
}
