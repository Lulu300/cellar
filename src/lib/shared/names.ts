/**
 * A producer's name as it is stored: trimmed, each run of blanks (a tab, a non-breaking space…)
 * made one space. Null and blank names are ''.
 */
export function tidyName(name: unknown): string {
    return name == null ? '' : String(name).replace(/\s+/g, ' ').trim();
}

/**
 * `text` without its case or accents, a typographic apostrophe read as a straight one, as a search
 * compares it: « chat » is in « Château », « d'yquem » in « Château d’Yquem ».
 */
export function folded(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[\u2018\u2019\u02bc]/g, "'")
        .toLowerCase();
}

/**
 * Whether the texts given hold every word of `query` between them, capitals, accents and the kind
 * of apostrophe aside:
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
    return folded(tidyName(name));
}

/**
 * Two names are close when they have the same numbers and one has every word of the other, a word
 * matching a word it starts or that starts it (« Dom. » and « Domaine »), or when they differ by a
 * letter, or two in a name of ten letters or more: « Domaine Lefalive » and « Domaine Leflaive ».
 */
export function areClose(a: string, b: string): boolean {
    const words = (text: string) => folded(text).match(/[\p{L}\p{N}]+/gu) ?? [];
    const numbers = (text: string) => (text.match(/\d+/g) ?? []).join(' ');
    if (numbers(a) !== numbers(b)) return false;
    const [x, y] = [words(a), words(b)];
    if (x.length === 0 || y.length === 0) return false;
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    const matches = (word: string, other: string) =>
        word === other ||
        (Math.min(word.length, other.length) >= 3 &&
            (word.startsWith(other) || other.startsWith(word)));
    if (short.every((word) => long.some((other) => matches(word, other)))) return true;
    const [first, second] = [x.join(' '), y.join(' ')];
    const allowed = Math.min(2, Math.floor(Math.min(first.length, second.length) / 5));
    return (
        Math.abs(first.length - second.length) <= allowed && editDistance(first, second) <= allowed
    );
}

function editDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        }
        previous = current;
    }
    return previous[b.length];
}
