export const PIE_CENTER = 100;
export const PIE_RADIUS = 80;

export type PieSlice = { full: true } | { full: false; path: string };

// Three decimals are far below a pixel, and keep floating-point noise out of the markup.
function pointAt(angle: number): string {
    const x = PIE_CENTER + PIE_RADIUS * Math.cos(angle);
    const y = PIE_CENTER + PIE_RADIUS * Math.sin(angle);
    return `${Number(x.toFixed(3))} ${Number(y.toFixed(3))}`;
}

/**
 * The shape of each slice, in the order of the counts, clockwise from 12 o'clock. An SVG arc that
 * starts and ends at the same point draws nothing, so a slice that is the whole pie is a circle,
 * and an empty slice is null: its white border would otherwise cross the pie.
 */
export function pieSlices(counts: number[]): (PieSlice | null)[] {
    const total = counts.reduce((sum, count) => sum + count, 0);
    let start = -Math.PI / 2;
    return counts.map((count) => {
        if (count === 0) return null;
        if (count === total) return { full: true };
        const end = start + (count / total) * 2 * Math.PI;
        const largeArc = count / total > 0.5 ? 1 : 0;
        const path = `M ${PIE_CENTER} ${PIE_CENTER} L ${pointAt(start)} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${pointAt(end)} Z`;
        start = end;
        return { full: false, path };
    });
}
