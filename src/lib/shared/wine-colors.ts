// The colour value of each wine colour (FEAT-03): the seeded ones start with a colour of their
// own, found by their name; any other starts neutral until the user picks one in the admin.

/** The colour of a wine colour that has none of its own yet. */
export const NEUTRAL_HEX = '#9ca3af';

/**
 * A name as the palettes compare it: neither case, accents nor blanks count, so that `Rosé` and
 * ` rose ` match.
 */
export function paletteKey(name: string | null | undefined): string {
    return (name ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();
}

// Keyed on the name, not the id: the seeded rows get a random id on each install. The English
// names cover a seeded row that the user translated. Migration 0019 gives existing rows the same.
const STARTING_HEX: Record<string, string> = {
    rouge: '#7b1e2b',
    red: '#7b1e2b',
    blanc: '#ead98b',
    white: '#ead98b',
    rose: '#f2a08c',
    jaune: '#d4952a',
    yellow: '#d4952a',
    'n/a': NEUTRAL_HEX
};

/** The colour that a wine colour named `name` starts with. */
export const startingHex = (name: string): string => STARTING_HEX[paletteKey(name)] ?? NEUTRAL_HEX;
