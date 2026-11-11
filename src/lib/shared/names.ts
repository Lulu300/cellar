/**
 * A producer's name as it is stored: trimmed, each run of blanks (a tab, a non-breaking space…)
 * made one space. Null and blank names are ''.
 */
export function tidyName(name: unknown): string {
    return name == null ? '' : String(name).replace(/\s+/g, ' ').trim();
}

/** `text` without its case or accents, as a search compares it: « chat » is in « Château ». */
export function folded(text: string): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Whether the texts given hold every word of `query` between them, capitals and accents aside:
 * « cotes rhone » matches « Côtes du Rhône ».
 */
export function matchesEveryWord(query: string) {
    const words = folded(query).split(/\s+/).filter(Boolean);
    return (texts: (string | null | undefined)[]) => {
        const text = folded(texts.join(' '));
        return words.every((word) => text.includes(word));
    };
}

/**
 * The key that two names of one producer share (FEAT-07): neither case, accents nor blanks count,
 * and a typographic apostrophe is a straight one. « Château  Margaux » and « chateau margaux » have
 * the same key; « ChâteauMargaux » does not. '' for no name.
 */
export function producerKey(name: unknown): string {
    return folded(tidyName(name)).replace(/[\u2018\u2019\u02bc]/g, "'");
}
