import { paletteKey } from '#lib/shared/wine-colors.js';

/**
 * How a wine type is drawn: the classes of its badge, and its fill in a chart. A wine colour has a
 * colour value of its own (wine-color.ts).
 */
interface Swatch {
    badge: string;
    fill: string;
}

// These colours stay the same in every theme: a type keeps its hue wherever it shows.
// Tailwind only generates the classes it finds whole in the source, so each one is spelt out.
// A badge is the 100 and 800 shades of its hue and its fill the 700 shade, so that a chart and
// the badges show a name in the same colour. Grey, for no value, fills with the lighter 500 shade
// so that it stays muted.
const swatch = {
    grey: { badge: 'bg-gray-100 text-gray-800', fill: '#6b7280' },
    blue: { badge: 'bg-blue-100 text-blue-800', fill: '#1d4ed8' },
    yellow: { badge: 'bg-yellow-100 text-yellow-800', fill: '#a16207' },
    green: { badge: 'bg-green-100 text-green-800', fill: '#15803d' },
    purple: { badge: 'bg-purple-100 text-purple-800', fill: '#7e22ce' },
    orange: { badge: 'bg-orange-100 text-orange-800', fill: '#c2410c' },
    teal: { badge: 'bg-teal-100 text-teal-800', fill: '#0f766e' },
    cyan: { badge: 'bg-cyan-100 text-cyan-800', fill: '#0e7490' },
    rose: { badge: 'bg-rose-100 text-rose-800', fill: '#be123c' },
    fuchsia: { badge: 'bg-fuchsia-100 text-fuchsia-800', fill: '#a21caf' }
} satisfies Record<string, Swatch>;

// Keyed on the name, not the id: the seeded rows get a random id on each install, and the
// statistics only give names. Names are compared as paletteKey compares them. The English names
// cover a seeded row that the user translated.
interface Palette {
    /** The seeded names, normalized. */
    known: Record<string, Swatch>;
    /**
     * For the other names, such as a type the user created: hues far from those of `known`, so
     * that a new type does not pass for a seeded one.
     */
    others: Swatch[];
}

const TYPES: Palette = {
    known: {
        vin: swatch.blue,
        wine: swatch.blue,
        champagne: swatch.yellow,
        mousseux: swatch.green,
        sparkling: swatch.green,
        spiritueux: swatch.purple,
        spirits: swatch.purple
    },
    others: [swatch.teal, swatch.cyan, swatch.orange, swatch.rose, swatch.fuchsia]
};

/** Names that mean "none": the seeded N/A, and the server's name for a missing reference. */
const NO_VALUE = new Set(['n/a', 'unknown', '']);

/** The same hash for the same name, on every page and every install. */
function hash(key: string): number {
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    return hash;
}

function swatchOf({ known, others }: Palette, name: string | null | undefined): Swatch {
    const key = paletteKey(name);
    if (NO_VALUE.has(key)) return swatch.grey;
    return known[key] ?? others[hash(key) % others.length];
}

/** The classes of the badge of a wine type, from its name. */
export const typeBadgeClass = (name: string | null | undefined) => swatchOf(TYPES, name).badge;

/** The fill of a wine type in a chart, from its name. */
export const typeFill = (name: string | null | undefined) => swatchOf(TYPES, name).fill;
