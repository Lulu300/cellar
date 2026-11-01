import { m } from '#lib/paraglide/messages.js';
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
