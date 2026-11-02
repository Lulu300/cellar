import { containerLabel } from '#lib/shared/storage.js';

/**
 * What a case adds to the name of its container, which the container dialog edits: "1" for case
 * "A1" of container "A". A case named otherwise, by an import, gives its whole name: the number
 * that ends it would give "Top1" and "Bottom1" the same suffix, which a container refuses.
 */
export function caseSuffix(caseName: string, containerName: string): string {
    for (const prefix of [containerName, containerLabel(containerName)]) {
        if (caseName.startsWith(prefix)) return caseName.slice(prefix.length);
    }
    return caseName;
}

/** How full a case is, as a whole percentage. */
export function utilization(capacity: number, bottles: number): number {
    return capacity > 0 ? Math.round((bottles / capacity) * 100) : 0;
}

// The occupancy scale keeps fixed colours: it carries a status in every theme, and its pills bring
// their own light background.
export function utilizationColor(percent: number): string {
    if (percent >= 90) return 'text-red-700 bg-red-50';
    if (percent >= 70) return 'text-orange-700 bg-orange-50';
    if (percent >= 50) return 'text-yellow-700 bg-yellow-50';
    return 'text-green-700 bg-green-50';
}
