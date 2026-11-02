import { m } from '#lib/paraglide/messages.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { WineGroupDTO } from '#lib/shared/dto.js';
import { formatPriceRange, formatRating, formatVintageRange } from '#lib/utils/format.js';
import { priceStats, vintageRange } from '#lib/utils/wine-group-sort.js';

/**
 * What the card and the row of a wine show of it and of its bottles still owned, the only ones
 * that the list loads: both views give the same values.
 */
export function wineFacts({ definition, bottles }: Pick<WineGroupDTO, 'definition' | 'bottles'>) {
    return {
        producer: definition.producer || m['wines.unknown_producer'](),
        place: `${definition.region}, ${definition.country}`,
        bottleCount: bottles.length,
        vintage: formatVintageRange(vintageRange(bottles)),
        price: formatPriceRange(priceStats(bottles)),
        rating: formatRating(definition.rating)
    };
}

/**
 * How many bottles of a wine each case holds, by the name of the case, as the Storage locations box
 * of its page lists them: the bottles in the cellar only, as the storage page counts a case. A
 * bottle out of the cellar or drunk keeps the case it left without being there.
 */
export function storageLocations(
    bottles: { availability: string; storageCase?: { name: string } | null }[]
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const bottle of bottles) {
        if (bottle.availability !== BottleAvailability.AVAILABLE) continue;
        const location = bottle.storageCase?.name || m['common.not_available']();
        counts[location] = (counts[location] ?? 0) + 1;
    }
    return counts;
}
