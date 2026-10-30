// Compares the messages that src/ uses (`m['key']`) with the locale files, and looks for text
// written in the components instead of the locale files.
// Fails on a key that a locale lacks, a key defined twice, a key in one locale only, a key that
// nothing uses, a key the script cannot read, a plural made by hand, the same text under two keys,
// a text with three dots, a French text with straight quotes, and hardcoded text, three dots included.
// Hardcoded text is looked for where the page shows it: text between tags, text attributes,
// string literals in the expressions of the text and of those attributes, the first argument of
// `toasts.add` and of the browser's `alert`, `confirm` and `prompt`, and the label-like properties
// of objects. A string held in a variable first (`const message = 'Saved'`), passed to a snippet
// (`{@render row('Name')}`) or nested in the interpolation of a template literal is not seen; a
// prose literal compared or passed as an argument in a shown expression is reported, and belongs
// in the script instead.
// Comments are not stripped: a call left in a comment still counts as a use.
// Its tests (check-i18n.test.ts) run checkI18n on the project in check-i18n-cases/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = 'src/lib/i18n/locales';
const LOCALES = ['en', 'fr'];
// Generated from the locale files
const GENERATED = 'src/lib/paraglide';

// A key is read from `m['key']` only: written out, it can be checked, and the bundler keeps just
// the messages a page uses.
const MESSAGE = /(?<![\w$.])m\[/g;

// Attributes whose value the user reads or hears
const TEXT_ATTRIBUTES = [
    'placeholder',
    'title',
    'alt',
    'aria-label',
    'aria-description',
    'label',
    'content',
    // Props of the app's own components (FormField, …)
    'hint',
    'description',
    'message',
    'text'
];
const TEXT_ATTRIBUTE = new RegExp(`\\s(${TEXT_ATTRIBUTES.join('|')})=(?:"([^"]*)"|'([^']*)')`, 'g');
// The properties that the components show, the toasts and the browser's dialogs, in the code that
// runs in the browser
const TEXT_PROPERTY =
    /(?:\b(?:name|label|title|description|placeholder|message|hint|text)\s*:|\btoasts\.add\(|\b(?:alert|confirm|prompt)\()\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;
// Server code, tests and the API schemas speak English to logs and scripts, not to the user.
const NOT_UI = /^src\/(lib\/(server|db|shared)|test)\/|\.server\.ts$|\+server\.ts$|\.test\.ts$/;
// A plural made by hand, « bouteille(s) » or `bottle{plural}`, instead of an ICU plural
const HAND_PLURAL = /\((?:s|e|es|x)\)|\{plural\}/;
// Three dots rather than …: texts end with « … » in both languages
const THREE_DOTS = /\.\.\./;
// The typography of French: ’ and « » rather than straight quotes, and … too
const FRENCH_TYPOGRAPHY = new RegExp(`['"]|${THREE_DOTS.source}`);
/**
 * The texts that keep two keys on purpose, because their context could change their translation.
 * Any other text has one key, in `common.*` when several pages share it.
 */
const SAME_TEXT_ALLOWED = [
    // The name of the barcode page in the menu, and the barcode of a bottle
    ['common.barcode', 'navigation.barcode'],
    // The examples of two fields, which happen to be the same wine
    ['placeholders.producer_example', 'placeholders.wine_name_example']
];
// A word: two letters in a row, in any language
const WORD = /\p{L}{2}/u;
// Between tags, even one letter is text: the « s » of `{decade}s`. Both languages are written in
// the Latin script, which leaves out symbols such as « ℹ️ ».
const LETTER = /\p{Script=Latin}/u;
// Text rather than an identifier: a space, or a capital first
const PROSE = /\s|^\p{Lu}/u;

/**
 * Whether a string that the page shows is text, by the test of its place (`looksLikeText`), or
 * holds three dots, such as `{m['common.updating']()}...`: the locale files hold those too.
 * @param {string} text
 * @param {boolean} looksLikeText
 */
const isShownText = (text, looksLikeText) => looksLikeText || THREE_DOTS.test(text);

/**
 * Reads the string or template literal starting at `start`, or returns null for any other
 * expression. `end` is the index of the closing quote.
 * @param {string} text
 * @param {number} start
 */
function readLiteral(text, start) {
    const quote = text[start];
    if (!`'"\``.includes(quote)) return null;
    let value = '';
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === '\\') value += text[++i];
        else if (text[i] === quote) return { value, end: i, template: quote === '`' };
        else value += text[i];
    }
    return null;
}

/**
 * @param {string} text
 * @param {number} index
 */
function skipSpaces(text, index) {
    while (/\s/.test(text[index])) index++;
    return index;
}

/**
 * @param {string} text
 * @param {number} index
 */
function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

/**
 * The code of `root`, as paths relative to it.
 * @param {string} root
 */
function sourceFiles(root) {
    return readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
        .map((file) => join('src', file))
        .filter((file) => /\.(svelte|ts|js)$/.test(file) && !file.startsWith(GENERATED))
        .sort();
}

/**
 * Every key the code uses, with the places that use it, and the uses that could not be read.
 * @param {[file: string, text: string][]} files
 */
function collectUsedKeys(files) {
    /** @type {Map<string, string[]>} */
    const used = new Map();
    /** @type {string[]} */
    const unreadable = [];
    for (const [file, text] of files) {
        for (const match of text.matchAll(MESSAGE)) {
            const where = `${file}:${lineOf(text, match.index)}`;
            const literal = readLiteral(text, skipSpaces(text, match.index + match[0].length));
            if (!literal || (literal.template && literal.value.includes('${'))) {
                unreadable.push(`${where}: the key is not written out`);
            } else {
                used.set(literal.value, [...(used.get(literal.value) ?? []), where]);
            }
        }
    }
    return { used, unreadable };
}

/**
 * Replaces the `{…}` expressions of Svelte markup with spaces, keeping the line breaks, so that
 * what remains is tags and text. Also returns the string literals of the expressions that the page
 * shows: in the text, or as the value of a text attribute; not a block (`{#if x === 'Rouge'}`) nor
 * another attribute (`class={…}`).
 * @param {string} markup
 */
function readMarkup(markup) {
    let blanked = '';
    /** @type {{ value: string, at: number }[]} */
    const literals = [];
    let depth = 0;
    let shown = false;
    for (let i = 0; i < markup.length; i++) {
        const char = markup[i];
        // A comment inside an expression, whose apostrophes (« doesn't ») are not quotes
        const comment = depth > 0 && char === '/' && markup.slice(i, i + 2).match(/\/\/|\/\*/)?.[0];
        if (comment) {
            const end = markup.indexOf(comment === '//' ? '\n' : '*/', i);
            const stop = end === -1 ? markup.length : comment === '//' ? end : end + 2;
            blanked += markup.slice(i, stop).replace(/[^\n]/g, ' ');
            i = stop - 1;
            continue;
        }
        // A quote right after a slash belongs to a regular expression (`/'/g`), not a string
        if (depth > 0 && `'"\``.includes(char) && markup[i - 1] !== '/') {
            const literal = readLiteral(markup, i);
            if (literal) {
                if (shown)
                    literals.push({ value: literal.value.replace(/\$\{[^}]*\}/g, ''), at: i });
                blanked += markup.slice(i, literal.end + 1).replace(/[^\n]/g, ' ');
                i = literal.end;
                continue;
            }
        }
        if (char === '{') {
            if (depth === 0) {
                const before = blanked.slice(blanked.lastIndexOf('>') + 1);
                // Inside a tag, the attribute the expression is the value of, or is part of
                const attribute = before.includes('<')
                    ? before.match(/([\w:-]+)\s*=\s*"?[^"=]*$/)?.[1]
                    : undefined;
                shown = before.includes('<')
                    ? attribute !== undefined && TEXT_ATTRIBUTES.includes(attribute)
                    : !'#:/@'.includes(markup[i + 1]);
            }
            depth++;
        }
        blanked += depth > 0 && char !== '\n' ? ' ' : char;
        if (char === '}' && depth > 0) depth--;
    }
    return { blanked, literals };
}

/** @typedef {{ text: string, at: number }} Found A text, and its index in the file. */

/**
 * Text shown to the user but written outside the locale files: markup, attributes, properties.
 * @param {string} file
 * @param {string} source
 */
function findHardcodedText(file, source) {
    if (NOT_UI.test(file)) return [];
    /** @type {Found[]} */
    const found = [];
    for (const match of source.matchAll(TEXT_PROPERTY)) {
        const value = match[2];
        if (WORD.test(value) && PROSE.test(value)) found.push({ text: match[0], at: match.index });
    }
    if (!file.endsWith('.svelte')) return found.map((item) => locate(file, source, item));
    // Scripts, styles, comments and the meta tags that instruct the browser (`http-equiv`, whose
    // `content` is not text), blanked so that the line numbers stay right
    const blank = (/** @type {string} */ match) => match.replace(/[^\n]/g, ' ');
    const { blanked: markup, literals } = readMarkup(
        source
            .replace(/<script\b[\s\S]*?<\/script>/g, blank)
            .replace(/<style\b[\s\S]*?<\/style>/g, blank)
            .replace(/<!--[\s\S]*?-->/g, blank)
            .replace(/<meta\s[^>]*\bhttp-equiv\s*=[^>]*>/g, blank)
    );
    for (const { value, at } of literals) {
        if (isShownText(value, WORD.test(value) && PROSE.test(value))) {
            found.push({ text: `'${value}'`, at });
        }
    }
    for (const match of markup.matchAll(TEXT_ATTRIBUTE)) {
        const [text, , double, single] = match;
        const value = double ?? single;
        if (isShownText(value, WORD.test(value))) {
            found.push({ text: text.trim(), at: match.index });
        }
    }
    // Text between tags; a tag never holds `>` once the expressions are blanked
    for (const match of markup.matchAll(/>([^<]+)</g)) {
        const text = match[1].replace(/&[a-z]+;/g, ' ').trim();
        if (isShownText(text, LETTER.test(text))) found.push({ text, at: match.index });
    }
    return found.map((item) => locate(file, markup, item));
}

/**
 * @param {string} file
 * @param {string} text
 * @param {Found} found
 */
function locate(file, text, { text: found, at }) {
    return `${file}:${lineOf(text, at)}: ${found.split(/\s+/).join(' ')}`;
}

/**
 * The messages of a locale file, with the keys defined twice, the values that are not text, the
 * plurals made by hand and the texts of another typography: three dots, and in French straight
 * quotes. JSON.parse keeps the last of two equal keys silently, so this reads the lines; the files
 * are flat, one key per line, as the ICU plugin of Paraglide reads them.
 * @param {string} root
 * @param {string} name
 */
function readLocale(root, name) {
    const text = readFileSync(join(root, LOCALES_DIR, `${name}.json`), 'utf8');
    const messages = JSON.parse(text);
    const seen = new Set();
    /** @type {string[]} */
    const duplicates = [];
    for (const match of text.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)) {
        const key = JSON.parse(match[1]);
        if (seen.has(key)) duplicates.push(`${name}: ${key} (line ${lineOf(text, match.index)})`);
        seen.add(key);
    }
    const notText = Object.entries(messages)
        .filter(([, value]) => typeof value !== 'string')
        .map(([key]) => `${name}: ${key}`);
    const matching = (/** @type {RegExp} */ pattern) =>
        Object.entries(messages)
            .filter(([, value]) => pattern.test(value))
            .map(([key, value]) => `${name}: ${key}: ${value}`);
    return {
        name,
        messages,
        keys: new Set(Object.keys(messages)),
        duplicates,
        notText,
        handPlurals: matching(HAND_PLURAL),
        typography: matching(name === 'fr' ? FRENCH_TYPOGRAPHY : THREE_DOTS)
    };
}

/**
 * The texts that have several keys, the same in every locale, outside the pairs `allowed`.
 * @param {ReturnType<typeof readLocale>[]} locales
 * @param {string[][]} allowed
 */
function sameTexts(locales, allowed) {
    /** @type {Map<string, string[]>} */
    const keysByText = new Map();
    for (const key of locales[0].keys) {
        const texts = locales.map((locale) => locale.messages[key]);
        if (texts.some((text) => typeof text !== 'string')) continue;
        const id = JSON.stringify(texts);
        keysByText.set(id, [...(keysByText.get(id) ?? []), key]);
    }
    const isAllowed = (/** @type {string[]} */ keys) =>
        allowed.some(
            (pair) => pair.length === keys.length && pair.every((key) => keys.includes(key))
        );
    return [...keysByText]
        .filter(([, keys]) => keys.length > 1 && !isAllowed(keys))
        .map(([id, keys]) => `${keys.join(', ')}: ${JSON.parse(id).join(' / ')}`);
}

/**
 * @param {string} title
 * @param {string[]} lines
 */
function report(title, lines) {
    console.log(`${title}: ${lines.length}`);
    for (const line of lines) console.log(`  ${line}`);
    return lines.length;
}

/** The reports of checkI18n, by the name of their list, in the order the command prints them. */
const REPORTS = {
    unreadable: 'Unreadable keys',
    missing: 'Missing keys',
    duplicates: 'Duplicate keys',
    notText: 'Values that are not text',
    handPlurals: 'Plurals made by hand',
    sameText: 'Same text under several keys',
    typography: 'Typography',
    oneLocaleOnly: 'Keys in one locale only',
    unused: 'Unused keys',
    hardcoded: 'Hardcoded text'
};

/**
 * Checks the project in the folder `root`: a list of problems for each report. `allowedSameText`
 * lists the keys that may share a text.
 * @param {string} root
 * @param {string[][]} [allowedSameText]
 */
export function checkI18n(root, allowedSameText = SAME_TEXT_ALLOWED) {
    const files = sourceFiles(root).map(
        (file) => /** @type {[string, string]} */ ([file, readFileSync(join(root, file), 'utf8')])
    );
    const { used, unreadable } = collectUsedKeys(files);
    const hardcoded = files.flatMap(([file, text]) => findHardcodedText(file, text));
    const locales = LOCALES.map((name) => readLocale(root, name));

    const allKeys = new Set(locales.flatMap((locale) => [...locale.keys]));
    const localesWhere = (/** @type {boolean} */ hasKey, /** @type {string} */ key) =>
        locales
            .filter((locale) => locale.keys.has(key) === hasKey)
            .map((locale) => locale.name)
            .join(', ');
    const isIncomplete = (/** @type {string} */ key) =>
        locales.some((locale) => !locale.keys.has(key));

    const missing = [...used.keys()]
        .filter(isIncomplete)
        .sort()
        .map((key) => `${key} (absent from ${localesWhere(false, key)}; used at ${used.get(key)})`);
    const unusedKeys = [...allKeys].filter((key) => !used.has(key)).sort();
    // A used key absent from a locale is already reported as missing.
    const oneLocaleOnly = unusedKeys
        .filter(isIncomplete)
        .map((key) => `${key} (only in ${localesWhere(true, key)})`);
    const unused = unusedKeys.filter((key) => !isIncomplete(key));

    return {
        unreadable,
        missing,
        duplicates: locales.flatMap((locale) => locale.duplicates),
        notText: locales.flatMap((locale) => locale.notText),
        handPlurals: locales.flatMap((locale) => locale.handPlurals),
        sameText: sameTexts(locales, allowedSameText),
        typography: locales.flatMap((locale) => locale.typography),
        oneLocaleOnly,
        unused,
        hardcoded
    };
}

// Run as `pnpm i18n:check`, not when the tests import it
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const problems = checkI18n(fileURLToPath(new URL('..', import.meta.url)));
    let failures = 0;
    for (const [name, title] of Object.entries(REPORTS)) {
        failures += report(title, problems[/** @type {keyof typeof REPORTS} */ (name)]);
    }
    if (failures > 0) {
        console.log('\ni18n check failed.');
        process.exit(1);
    }
    console.log('\ni18n check passed.');
}
